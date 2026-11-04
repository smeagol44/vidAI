/** Allowlisted VIDA Project #1 Status updater, for GitHub Actions (#75, #105). */
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const authorizedAuthors = Object.freeze(['smeagol44', 'hernansgarro']);

export const statuses = Object.freeze({
  backlog:'Backlog', 'needs-decision':'Needs decision', ready:'Ready',
  'in-progress':'In progress', 'in-review':'In review', testing:'Testing', done:'Done'
});
export function parseStatusCommand(comment) {
  if (typeof comment !== 'string') return null;
  const match = /^\/vida status ([a-z-]+)$/i.exec(comment.trim());
  return match ? (statuses[match[1].toLowerCase()] ?? null) : null;
}
export function validateRequest(env) {
  const author = typeof env.VIDA_COMMENT_AUTHOR === 'string' ? env.VIDA_COMMENT_AUTHOR.toLowerCase() : '';
  if (!authorizedAuthors.includes(author) || env.GITHUB_REPOSITORY !== 'smeagol44/vidAI') {
    throw new Error('Only authorized contributors in the VIDA repository can change Project Status');
  }
  const status = parseStatusCommand(env.VIDA_COMMENT_BODY);
  if (!status) throw new Error('Invalid VIDA status command');
  if (!/^[-\w]{10,200}$/.test(env.VIDA_CONTENT_ID || '')) throw new Error('Missing GitHub issue/PR node ID');
  if (env.VIDA_CONTENT_STATE !== 'open' && env.VIDA_CONTENT_STATE !== 'closed') throw new Error('Invalid item state');
  if (env.VIDA_CONTENT_STATE === 'open' && status === 'Done') throw new Error('Only completed/closed items can be Done');
  if (env.VIDA_CONTENT_STATE === 'closed' && status !== 'Done') throw new Error('Reopen item before selecting an active status');
  return status;
}
export function createClient(token, request = fetch) {
  if (!token) throw new Error('Configure repository secret VIDA_PROJECT_TOKEN before using the bridge');
  return async (query, variables) => {
    const response = await request('https://api.github.com/graphql', {
      method:'POST',
      headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
      body:JSON.stringify({query,variables})
    });
    if (!response.ok) throw new Error('GitHub Projects HTTP '+response.status);
    const body = await response.json();
    if (body.errors?.length) throw new Error('GitHub Projects GraphQL error: '+body.errors.map(x=>x.message).join('; '));
    return body.data;
  };
}
const projectQuery = 'query($owner:String!,$number:Int!){user(login:$owner){projectV2(number:$number){id fields(first:100){nodes{... on ProjectV2SingleSelectField{id name options{id name}}}}}}}';
const itemsQuery = 'query($project:ID!,$cursor:String){node(id:$project){... on ProjectV2{items(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{id content{... on Issue{id} ... on PullRequest{id}}}}}}}';
const addMutation = 'mutation($project:ID!,$content:ID!){addProjectV2ItemById(input:{projectId:$project,contentId:$content}){item{id}}}';
const statusMutation = 'mutation($project:ID!,$item:ID!,$field:ID!,$option:String!){updateProjectV2ItemFieldValue(input:{projectId:$project,itemId:$item,fieldId:$field,value:{singleSelectOptionId:$option}}){projectV2Item{id fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}';

/** Update field for matching issue/PR node ID; do not create duplicate cards. */
export async function setProjectStatus(graphql, contentId, status) {
  const initial = await graphql(projectQuery,{owner:'smeagol44',number:1});
  const project = initial?.user?.projectV2;
  if (!project?.id) throw new Error('Cannot access personal VIDA Project #1');
  const fields = (project.fields?.nodes ?? []).filter(f=>f?.name==='Status');
  if (fields.length!==1) throw new Error('Status field is missing or ambiguous');
  const field = fields[0], options=field.options.filter(x=>x.name===status);
  if (options.length!==1) throw new Error('Status option is missing or ambiguous: '+status);
  let cursor=null, itemId=null;
  for (;;) {
    const response=await graphql(itemsQuery,{project:project.id,cursor});
    const items=response?.node?.items;
    if (!items?.nodes || !items?.pageInfo) throw new Error('Cannot list Project items');
    const found=items.nodes.find(x=>x.content?.id===contentId);
    if (found){itemId=found.id;break;}
    if (!items.pageInfo.hasNextPage) break;
    if (!items.pageInfo.endCursor || items.pageInfo.endCursor===cursor) throw new Error('Invalid Project pagination');
    cursor=items.pageInfo.endCursor;
  }
  let added=false;
  if (!itemId) {
    const addedResponse=await graphql(addMutation,{project:project.id,content:contentId});
    itemId=addedResponse?.addProjectV2ItemById?.item?.id;
    if (!itemId) throw new Error('Could not add Project item');
    added=true;
  }
  const result=await graphql(statusMutation,{project:project.id,item:itemId,field:field.id,option:options[0].id});
  const actual=result?.updateProjectV2ItemFieldValue?.projectV2Item?.fieldValueByName?.name;
  if (actual!==status) throw new Error('Project field readback mismatch: '+String(actual));
  return {status:actual,added,itemId};
}
async function main(env=process.env) {
  const status=validateRequest(env);
  const graphql=createClient(env.VIDA_PROJECT_TOKEN);
  const result=await setProjectStatus(graphql,env.VIDA_CONTENT_ID,status);
  console.log('Verified VIDA Project Status = '+result.status+' ('+(result.added?'new':'existing')+' item)');
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error('VIDA Project Status bridge failed: '+error.message);process.exitCode=1;});
}

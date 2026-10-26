import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {authorizedAuthors, parseStatusCommand, validateRequest, setProjectStatus, createClient} from '../scripts/project-status-bridge.mjs';

const opts=(command,state='open')=>({
  VIDA_COMMENT_AUTHOR:'smeagol44',GITHUB_REPOSITORY:'smeagol44/vidAI',
  VIDA_COMMENT_BODY:command,VIDA_CONTENT_ID:'I_kwDOtest12345',VIDA_CONTENT_STATE:state
});
test('parse exactly seven statuses, never arbitrary comment instructions',()=>{
  for (const slug of ['backlog','needs-decision','ready','in-progress','in-review','testing','done']) {
    assert.ok(parseStatusCommand('/vida status '+slug));
  }
  for (const text of ['random','/vida status invalid','hello /vida status ready','/vida status ready\nanother command']) {
    assert.equal(parseStatusCommand(text),null);
  }
});
test('owner and named contributor retain command and item-state restrictions',()=>{
  for (const author of ['smeagol44', 'hernansgarro', 'HernansGarro']) {
    const request=(command,state)=>({...opts(command,state),VIDA_COMMENT_AUTHOR:author});
    for (const [slug,status] of Object.entries({backlog:'Backlog','needs-decision':'Needs decision',ready:'Ready','in-progress':'In progress','in-review':'In review',testing:'Testing'})) {
      assert.equal(validateRequest(request('/vida status '+slug)),status);
    }
    assert.equal(validateRequest(request('/vida status done','closed')),'Done');
    assert.throws(()=>validateRequest(request('/vida status done')),/closed/);
    assert.throws(()=>validateRequest(request('/vida status ready','closed')),/Reopen/);
    assert.throws(()=>validateRequest(request('/vida status invalid')),/Invalid VIDA status/);
    assert.throws(()=>validateRequest(request('/vida status ready\nanother command')),/Invalid VIDA status/);
    assert.throws(()=>validateRequest({...request('/vida status ready'),VIDA_CONTENT_ID:''}),/node ID/);
    assert.throws(()=>validateRequest({...request('/vida status ready'),VIDA_CONTENT_STATE:'merged'}),/Invalid item state/);
  }
  assert.throws(()=>createClient(''),/VIDA_PROJECT_TOKEN/);
});
test('unlisted accounts and all other repositories remain rejected',()=>{
  for (const author of ['someone','hernansgarro-bot','hernansgarro[bot]','hernansgarro ', '',undefined,null,42]) {
    assert.throws(()=>validateRequest({...opts('/vida status ready'),VIDA_COMMENT_AUTHOR:author}),/authorized contributors/);
  }
  for (const author of authorizedAuthors) {
    for (const repo of ['hernansgarro/vidAI','smeagol44/vidAI3D','someone/vidAI','',undefined]) {
      assert.throws(()=>validateRequest({...opts('/vida status ready'),VIDA_COMMENT_AUTHOR:author,GITHUB_REPOSITORY:repo}),/authorized contributors/);
    }
  }
});
test('workflow and script author gates agree and keep trusted upstream execution',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/project-status.yml',import.meta.url),'utf8');
  const gate=workflow.match(/    if: >-\n([\s\S]*?)    runs-on:/)?.[1];
  assert.ok(gate,'workflow must retain an authorization gate');
  const authors=[...gate.matchAll(/github\.event\.comment\.user\.login == '([^']+)'/g)].map(m=>m[1]);
  assert.deepEqual(authors,authorizedAuthors);
  assert.match(gate,/github\.repository == 'smeagol44\/vidAI' &&/);
  assert.match(gate,/\(\s*github\.event\.comment\.user\.login == 'smeagol44' \|\|\s*github\.event\.comment\.user\.login == 'hernansgarro'\s*\) &&/);
  assert.match(gate,/startsWith\(github\.event\.comment\.body, '\/vida status '\)/);
  assert.match(workflow,/issue_comment:\s*types: \[created\]/);
  assert.match(workflow,/VIDA_COMMENT_AUTHOR: \$\{\{ github\.event\.comment\.user\.login \}\}/);
  assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/head\.sha|head\.ref|pull_request_target/);
});
function client({exists=true,paginated=false,verify=true}={}){
  const calls=[];
  const graphql=async(q,v)=>{
    calls.push({q,v});
    if(q.startsWith('query($owner'))return {user:{projectV2:{
      id:'PVT_one',fields:{nodes:[{id:'PVTSSF_status',name:'Status',options:[{id:'abc',name:'In progress'}]}]}
    }}};
    if(q.startsWith('query($project')) {
      if(paginated && !v.cursor)return {node:{items:{
        pageInfo:{hasNextPage:true,endCursor:'cursor'},nodes:[{id:'other',content:{id:'X'}}]}}};
      return {node:{items:{pageInfo:{hasNextPage:false,endCursor:null},
        nodes:exists?[{id:'PVTI_one',content:{id:'I_kwDOtest12345'}}]:[]}}};
    }
    if(q.includes('addProjectV2ItemById'))return {addProjectV2ItemById:{item:{id:'PVTI_new'}}};
    if(q.includes('updateProjectV2ItemFieldValue'))return {updateProjectV2ItemFieldValue:{
      projectV2Item:{id:v.item,fieldValueByName:verify?{name:'In progress'}:null}}};
    throw new Error('Unexpected GraphQL query');
  };
  return {graphql,calls};
}
test('existing card is updated once without duplication, paginating to find it',async()=>{
  const {graphql,calls}=client({paginated:true});
  const res=await setProjectStatus(graphql,'I_kwDOtest12345','In progress');
  assert.equal(res.status,'In progress');
  assert.equal(res.added,false);
  assert.equal(calls.length,4);
  assert.equal(calls.at(-1).v.option,'abc');
});
test('missing card is added once, and then its Status field updated',async()=>{
  const {graphql,calls}=client({exists:false});
  const res=await setProjectStatus(graphql,'I_kwDOtest12345','In progress');
  assert.equal(res.added,true);
  assert.equal(calls.filter(c=>c.q.includes('addProjectV2ItemById')).length,1);
});
test('GraphQL field verification failure does not report success',async()=>{
  const {graphql}=client({verify:false});
  await assert.rejects(setProjectStatus(graphql,'I_kwDOtest12345','In progress'),/readback mismatch/);
});

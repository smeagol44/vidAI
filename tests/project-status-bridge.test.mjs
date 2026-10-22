import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseStatusCommand, validateRequest, setProjectStatus, createClient} from '../scripts/project-status-bridge.mjs';

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
test('only owner/repo commands; active status needs open item, Done needs closed',()=>{
  assert.equal(validateRequest(opts('/vida status in-progress')),'In progress');
  assert.equal(validateRequest(opts('/vida status done','closed')),'Done');
  assert.throws(()=>validateRequest({...opts('/vida status ready'),VIDA_COMMENT_AUTHOR:'someone'}),/owner/);
  assert.throws(()=>validateRequest({...opts('/vida status ready'),GITHUB_REPOSITORY:'smeagol44/vidAI3D'}),/owner/);
  assert.throws(()=>validateRequest(opts('/vida status done')),/closed/);
  assert.throws(()=>validateRequest(opts('/vida status ready','closed')),/Reopen/);
  assert.throws(()=>createClient(''),/VIDA_PROJECT_TOKEN/);
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

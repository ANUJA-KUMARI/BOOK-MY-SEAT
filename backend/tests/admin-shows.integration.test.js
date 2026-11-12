process.env.NODE_ENV='test';
const {describe,it,before,after}=require('node:test');const assert=require('node:assert/strict');
const app=require('../app');const auth=require('../services/auth.service');const service=require('../services/admin-shows.service');
const {config}=require('../config/env');const {signAccessToken}=require('../utils/jwt');const {closePool}=require('../config/db');
let server,base,originalAuth,originalList,originalCreate;
before(async()=>{originalAuth=auth.findUserById;originalList=service.listShows;originalCreate=service.createShow;
 auth.findUserById=async id=>id===901?{id,name:'Shows Admin',email:'shows-admin@example.com',role:'ADMIN'}:id===902?{id,name:'Regular User',email:'shows-user@example.com',role:'USER'}:null;
 service.listShows=async()=>[{id:1,status:'SCHEDULED'}];service.createShow=async input=>({id:2,...input});
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port;});
after(async()=>{auth.findUserById=originalAuth;service.listShows=originalList;service.createShow=originalCreate;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await closePool();});
function cookie(id){return'bms_token='+signAccessToken({id,role:'IGNORED'})+'; bms_csrf=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';}
async function request(path,{id,method='GET',body}={}){const headers={};if(id)headers.cookie=cookie(id);if(body){headers.origin=base;headers['content-type']='application/json';headers['x-csrf-token']='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';}return fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});}
describe('Phase 8 Stage 5 show route access',{skip:!config.jwt.secret},()=>{
 it('rejects unauthenticated show inventory access',async()=>assert.equal((await request('/api/admin/shows')).status,401));
 it('rejects USER accounts from show management',async()=>assert.equal((await request('/api/admin/shows',{id:902})).status,403));
 it('allows ADMIN to list shows',async()=>{const r=await request('/api/admin/shows',{id:901});assert.equal(r.status,200);assert.equal((await r.json()).data[0].status,'SCHEDULED');});
 it('allows ADMIN to submit a valid show with same-origin CSRF protection',async()=>{const r=await request('/api/admin/shows',{id:901,method:'POST',body:{movie_id:1,screen_id:2,start_time:'2099-05-20T14:30:00.000Z',prices:{STANDARD:200,PREMIUM:300,RECLINER:500}}});assert.equal(r.status,201);});
 it('rejects invalid prices before the service is called',async()=>{const r=await request('/api/admin/shows',{id:901,method:'POST',body:{movie_id:1,screen_id:2,start_time:'2099-05-20T14:30:00.000Z',prices:{STANDARD:-1,PREMIUM:300,RECLINER:500}}});assert.equal(r.status,400);});
});

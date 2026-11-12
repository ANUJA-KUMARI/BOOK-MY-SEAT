process.env.NODE_ENV='test';
const {describe,it}=require('node:test');const assert=require('node:assert/strict');
const {showInput,priceInput,statusInput}=require('../validators/admin-shows');
describe('Phase 8 Stage 5 show validation',()=>{
 it('accepts a future UTC show with all category prices',()=>{const x=showInput({movie_id:4,screen_id:9,start_time:'2099-05-20T14:30:00.000Z',prices:{STANDARD:220,PREMIUM:320,RECLINER:520}});assert.equal(x.movie_id,4);assert.equal(x.screen_id,9);assert.equal(x.start_time,'2099-05-20 14:30:00');assert.deepEqual(x.prices,{STANDARD:220,PREMIUM:320,RECLINER:520});});
 it('rejects invalid IDs, missing categories and unsupported price categories',()=>{assert.throws(()=>showInput({movie_id:0,screen_id:1,start_time:'2099-05-20T14:30:00.000Z',prices:{STANDARD:1,PREMIUM:2,RECLINER:3}}),/movie_id/i);assert.throws(()=>priceInput({prices:{STANDARD:1,PREMIUM:2}}),/RECLINER/i);assert.throws(()=>priceInput({prices:{STANDARD:1,PREMIUM:2,RECLINER:3,VIP:4}}),/Only STANDARD/i);});
 it('rejects invalid, past and non-UTC date times',()=>{for(const start_time of ['2099-02-30T14:30:00.000Z','2099-05-20T14:30:00','2020-01-01T00:00:00.000Z'])assert.throws(()=>showInput({movie_id:1,screen_id:1,start_time,prices:{STANDARD:1,PREMIUM:2,RECLINER:3}}));});
 it('rejects negative, excessive and over-precision prices',()=>{for(const prices of [{STANDARD:-1,PREMIUM:2,RECLINER:3},{STANDARD:1,PREMIUM:2,RECLINER:1000000},{STANDARD:1.001,PREMIUM:2,RECLINER:3}])assert.throws(()=>priceInput({prices}));});
 it('accepts only cancellation or completion status transitions',()=>{assert.equal(statusInput({status:'CANCELLED'}),'CANCELLED');assert.equal(statusInput({status:'COMPLETED'}),'COMPLETED');assert.throws(()=>statusInput({status:'SCHEDULED'}));});
});

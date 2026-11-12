process.env.NODE_ENV='test';
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {cinemaInput,screenInput,seatLayoutInput}=require('../validators/admin-venues');
describe('Phase 8 venue input validation',()=>{
 it('trims and validates cinema details',()=>assert.deepEqual(cinemaInput({name:' PVR Saket ',city:' Delhi ',address:' Select Citywalk '}),{name:'PVR Saket',city:'Delhi',address:'Select Citywalk'}));
 it('supports partial cinema updates',()=>assert.deepEqual(cinemaInput({city:'Mumbai'},true),{city:'Mumbai'}));
 it('rejects missing or oversized cinema fields',()=>{assert.throws(()=>cinemaInput({name:'',city:'Delhi',address:'Road'}),/name is required/i);assert.throws(()=>cinemaInput({name:'x'.repeat(181),city:'Delhi',address:'Road'}),/180 characters/i);});
 it('validates screen names',()=>assert.deepEqual(screenInput({name:' Screen 2 '}),{name:'Screen 2'}));
 it('validates seat rows and total seat limit',()=>assert.deepEqual(seatLayoutInput({rows:[{label:'A',count:10,category:'STANDARD'},{label:'B',count:8,category:'PREMIUM'}]}),[{label:'A',count:10,category:'STANDARD'},{label:'B',count:8,category:'PREMIUM'}]));
 it('rejects duplicate labels, invalid categories and excessive seats',()=>{assert.throws(()=>seatLayoutInput({rows:[{label:'A',count:5,category:'STANDARD'},{label:'A',count:5,category:'STANDARD'}]}),/unique/i);assert.throws(()=>seatLayoutInput({rows:[{label:'A',count:5,category:'VIP'}]}),/category/i);assert.throws(()=>seatLayoutInput({rows:Array.from({length:11},(_,i)=>({label:'R'+i,count:30,category:'STANDARD'}))}),/300 seats/i);});
});

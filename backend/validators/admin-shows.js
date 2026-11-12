const AppError=require('../utils/AppError');
const CATEGORIES=['STANDARD','PREMIUM','RECLINER'];
function object(value){if(!value||typeof value!=='object'||Array.isArray(value))throw new AppError(400,'A JSON object is required.');return value;}
function positiveId(value,field){if(!Number.isSafeInteger(value)||value<1)throw new AppError(400,field+' must be a positive whole-number ID.');return value;}
function startTime(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))throw new AppError(400,'start_time must be a UTC ISO-8601 timestamp ending in Z.');
 const ms=Date.parse(value);if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,19)!==value.slice(0,19))throw new AppError(400,'start_time must be a real date and time.');
 if(ms<=Date.now())throw new AppError(400,'A show must be scheduled in the future.');return new Date(ms).toISOString().slice(0,19).replace('T',' ');
}
function prices(value){
 object(value);const result={};
 for(const category of CATEGORIES){const n=value[category];if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>999999.99||Number(n.toFixed(2))!==n)throw new AppError(400,category+' price must be a number from 0 to 999999.99 with at most two decimal places.');result[category]=n;}
 if(Object.keys(value).some(k=>!CATEGORIES.includes(k)))throw new AppError(400,'Only STANDARD, PREMIUM and RECLINER prices are supported.');
 return result;
}
function showInput(body){const b=object(body);return {movie_id:positiveId(b.movie_id,'movie_id'),screen_id:positiveId(b.screen_id,'screen_id'),start_time:startTime(b.start_time),prices:prices(b.prices)};}
function priceInput(body){const b=object(body);return prices(b.prices);}
function statusInput(body){const b=object(body);if(!['CANCELLED','COMPLETED'].includes(b.status))throw new AppError(400,'status must be CANCELLED or COMPLETED.');return b.status;}
module.exports={showInput,priceInput,statusInput,CATEGORIES};

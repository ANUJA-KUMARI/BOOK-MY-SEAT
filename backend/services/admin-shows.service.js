const {getPool,toDatabaseError}=require('../config/db');
const AppError=require('../utils/AppError');
const {toIsoUtc}=require('../utils/time');
const {CATEGORIES}=require('../validators/admin-shows');
function mapShow(r,prices){return {id:Number(r.id),movie:{id:Number(r.movie_id),title:r.movie_title,duration_min:Number(r.duration_min)},cinema:{id:Number(r.cinema_id),name:r.cinema_name,city:r.city},screen:{id:Number(r.screen_id),name:r.screen_name},start_time:toIsoUtc(r.start_time),status:r.status,prices:Object.fromEntries(CATEGORIES.map(c=>[c,prices.get(c)??null]))};}
async function listShows(){
 try{const pool=getPool();const [rows]=await pool.execute('SELECT s.id,s.movie_id,m.title AS movie_title,m.duration_min,s.screen_id,sc.name AS screen_name,c.id AS cinema_id,c.name AS cinema_name,c.city,s.start_time,s.status FROM shows s JOIN movies m ON m.id=s.movie_id JOIN screens sc ON sc.id=s.screen_id JOIN cinemas c ON c.id=sc.cinema_id ORDER BY s.start_time DESC LIMIT 500');
 if(!rows.length)return [];const [ps]=await pool.query('SELECT show_id,category,price FROM show_prices WHERE show_id IN (?)',[rows.map(r=>r.id)]);const by=new Map();for(const p of ps){const id=Number(p.show_id);if(!by.has(id))by.set(id,new Map());by.get(id).set(p.category,Number(p.price));}return rows.map(r=>mapShow(r,by.get(Number(r.id))||new Map()));
 }catch(e){throw toDatabaseError(e);}
}
async function createShow(input){
 const pool=getPool();let conn;
 try{conn=await pool.getConnection();await conn.beginTransaction();
 const [screens]=await conn.execute('SELECT sc.id,sc.cinema_id FROM screens sc WHERE sc.id=? FOR UPDATE',[input.screen_id]);if(!screens.length)throw new AppError(404,'Screen not found.');
 const [movies]=await conn.execute('SELECT id,duration_min,is_active FROM movies WHERE id=? FOR UPDATE',[input.movie_id]);if(!movies.length)throw new AppError(404,'Movie not found.');if(!movies[0].is_active)throw new AppError(409,'Inactive movies cannot be scheduled.');
 const [seats]=await conn.execute('SELECT id FROM seats WHERE screen_id=? LIMIT 1',[input.screen_id]);if(!seats.length)throw new AppError(409,'Configure at least one seat on this screen before scheduling a show.');
 const duration=Number(movies[0].duration_min);
 const [conflicts]=await conn.execute("SELECT s.id,s.start_time,m.duration_min FROM shows s JOIN movies m ON m.id=s.movie_id WHERE s.screen_id=? AND s.status='SCHEDULED' AND s.start_time < DATE_ADD(?, INTERVAL ? MINUTE) AND DATE_ADD(s.start_time, INTERVAL m.duration_min MINUTE) > ? LIMIT 1",[input.screen_id,input.start_time,duration,input.start_time]);
 if(conflicts.length)throw new AppError(409,'This screen already has a scheduled show that overlaps the selected time.');
 const [result]=await conn.execute("INSERT INTO shows(movie_id,screen_id,start_time,status) VALUES(?,?,?,'SCHEDULED')",[input.movie_id,input.screen_id,input.start_time]);
 const id=Number(result.insertId);for(const category of CATEGORIES)await conn.execute('INSERT INTO show_prices(show_id,category,price) VALUES(?,?,?)',[id,category,input.prices[category]]);
 await conn.commit();return {id,movie_id:input.movie_id,screen_id:input.screen_id,start_time:new Date(input.start_time.replace(' ','T')+'Z').toISOString(),status:'SCHEDULED',prices:input.prices};
 }catch(e){if(conn)try{await conn.rollback();}catch{}if(e instanceof AppError)throw e;if(e.code==='ER_DUP_ENTRY')throw new AppError(409,'A show already exists at this exact start time on this screen.');throw toDatabaseError(e);}finally{if(conn)conn.release();}
}
async function updatePrices(id,prices){
 const pool=getPool();let conn;
 try{conn=await pool.getConnection();await conn.beginTransaction();const [rows]=await conn.execute("SELECT id FROM shows WHERE id=? AND status='SCHEDULED' AND start_time>UTC_TIMESTAMP() FOR UPDATE",[id]);if(!rows.length){const [found]=await conn.execute('SELECT id FROM shows WHERE id=?',[id]);if(!found.length)throw new AppError(404,'Show not found.');throw new AppError(409,'Prices can only be changed for future scheduled shows.');}
 for(const category of CATEGORIES)await conn.execute('INSERT INTO show_prices(show_id,category,price) VALUES(?,?,?) ON DUPLICATE KEY UPDATE price=VALUES(price)',[id,category,prices[category]]);
 await conn.commit();return {show_id:id,prices};
 }catch(e){if(conn)try{await conn.rollback();}catch{}if(e instanceof AppError)throw e;throw toDatabaseError(e);}finally{if(conn)conn.release();}
}
async function updateStatus(id,status){
 try{const pool=getPool();const [rows]=await pool.execute('SELECT id,status,start_time FROM shows WHERE id=?',[id]);if(!rows.length)return null;
 if(rows[0].status!=='SCHEDULED')throw new AppError(409,'Only scheduled shows can change status.');
 if(status==='COMPLETED'&&new Date(toIsoUtc(rows[0].start_time)).getTime()>Date.now())throw new AppError(409,'A future show cannot be marked completed.');
 await pool.execute('UPDATE shows SET status=? WHERE id=?',[status,id]);return {id,status};
 }catch(e){if(e instanceof AppError)throw e;throw toDatabaseError(e);}
}
module.exports={listShows,createShow,updatePrices,updateStatus};

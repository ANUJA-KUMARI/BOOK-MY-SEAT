const { getPool, toDatabaseError } = require('../config/db');
const AppError = require('../utils/AppError');
async function listCinemas() {
  try {
    const [rows] = await getPool().execute('SELECT c.id,c.name,c.city,c.address,COUNT(DISTINCT s.id) screen_count,COUNT(DISTINCT st.id) seat_count FROM cinemas c LEFT JOIN screens s ON s.cinema_id=c.id LEFT JOIN seats st ON st.screen_id=s.id GROUP BY c.id ORDER BY c.city,c.name');
    return rows.map(r=>({...r,id:Number(r.id),screen_count:Number(r.screen_count),seat_count:Number(r.seat_count)}));
  } catch(e){throw toDatabaseError(e);}
}
async function createCinema(input) {
  try { const [r]=await getPool().execute('INSERT INTO cinemas(name,city,address) VALUES(?,?,?)',[input.name,input.city,input.address]); return {id:Number(r.insertId),...input,screen_count:0,seat_count:0}; }
  catch(e){if(e.code==='ER_DUP_ENTRY') throw new AppError(409,'A cinema with these details may already exist.'); throw toDatabaseError(e);}
}
async function updateCinema(id,input) {
  try {
    const keys=['name','city','address'].filter(k=>Object.hasOwn(input,k));
    if(!keys.length) throw new AppError(400,'Provide at least one field to update.');
    const [r]=await getPool().execute('UPDATE cinemas SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?',[...keys.map(k=>input[k]),id]);
    if(!r.affectedRows){const [found]=await getPool().execute('SELECT id FROM cinemas WHERE id=?',[id]);if(!found.length)return null;}
    const [rows]=await getPool().execute('SELECT id,name,city,address FROM cinemas WHERE id=?',[id]);return {...rows[0],id:Number(rows[0].id)};
  } catch(e){if(e instanceof AppError)throw e;throw toDatabaseError(e);}
}
async function listScreens(cinemaId) {
  try {
    const [cinemas]=await getPool().execute('SELECT id FROM cinemas WHERE id=?',[cinemaId]);if(!cinemas.length)return null;
    const [rows]=await getPool().execute('SELECT s.id,s.cinema_id,s.name,COUNT(st.id) seat_count FROM screens s LEFT JOIN seats st ON st.screen_id=s.id WHERE s.cinema_id=? GROUP BY s.id ORDER BY s.name',[cinemaId]);
    return rows.map(r=>({...r,id:Number(r.id),cinema_id:Number(r.cinema_id),seat_count:Number(r.seat_count)}));
  }catch(e){throw toDatabaseError(e);}
}
async function createScreen(cinemaId,name) {
  try {const [c]=await getPool().execute('SELECT id FROM cinemas WHERE id=?',[cinemaId]);if(!c.length)return null;
    const [r]=await getPool().execute('INSERT INTO screens(cinema_id,name) VALUES(?,?)',[cinemaId,name]);return {id:Number(r.insertId),cinema_id:cinemaId,name,seat_count:0};
  }catch(e){if(e.code==='ER_DUP_ENTRY')throw new AppError(409,'This cinema already has a screen with that name.');throw toDatabaseError(e);}
}
async function updateScreen(id,name) {
  try {const [r]=await getPool().execute('UPDATE screens SET name=? WHERE id=?',[name,id]);if(!r.affectedRows){const [f]=await getPool().execute('SELECT id FROM screens WHERE id=?',[id]);if(!f.length)return null;}
    const [rows]=await getPool().execute('SELECT id,cinema_id,name FROM screens WHERE id=?',[id]);return {...rows[0],id:Number(rows[0].id),cinema_id:Number(rows[0].cinema_id)};
  }catch(e){if(e.code==='ER_DUP_ENTRY')throw new AppError(409,'This cinema already has a screen with that name.');throw toDatabaseError(e);}
}
async function listSeats(screenId) {
  try {const [screens]=await getPool().execute('SELECT id FROM screens WHERE id=?',[screenId]);if(!screens.length)return null;
    const [rows]=await getPool().execute('SELECT id,screen_id,row_label,seat_number,category FROM seats WHERE screen_id=? ORDER BY row_label,seat_number',[screenId]);
    return rows.map(r=>({...r,id:Number(r.id),screen_id:Number(r.screen_id),seat_number:Number(r.seat_number)}));
  }catch(e){throw toDatabaseError(e);}
}
async function replaceSeatLayout(screenId,rows) {
  const pool=getPool();let conn;
  try {
    conn=await pool.getConnection();await conn.beginTransaction();
    const [screens]=await conn.execute('SELECT id FROM screens WHERE id=? FOR UPDATE',[screenId]);if(!screens.length)throw new AppError(404,'Screen not found.');
    const [shows]=await conn.execute('SELECT id FROM shows WHERE screen_id=? LIMIT 1',[screenId]);
    if(shows.length)throw new AppError(409,'This screen already has shows. Its seat layout is locked to protect show and booking records.');
    await conn.execute('DELETE FROM seats WHERE screen_id=?',[screenId]);
    for(const row of rows)for(let n=1;n<=row.count;n++)await conn.execute('INSERT INTO seats(screen_id,row_label,seat_number,category) VALUES(?,?,?,?)',[screenId,row.label,n,row.category]);
    const [seats]=await conn.execute('SELECT id,screen_id,row_label,seat_number,category FROM seats WHERE screen_id=? ORDER BY row_label,seat_number',[screenId]);
    await conn.commit();return seats.map(r=>({...r,id:Number(r.id),screen_id:Number(r.screen_id),seat_number:Number(r.seat_number)}));
  }catch(e){if(conn)try{await conn.rollback();}catch{} if(e instanceof AppError)throw e;throw toDatabaseError(e);}
  finally{if(conn)conn.release();}
}
module.exports={listCinemas,createCinema,updateCinema,listScreens,createScreen,updateScreen,listSeats,replaceSeatLayout};

const service=require('../services/admin-venues.service');
const {sendSuccess}=require('../utils/response');
const AppError=require('../utils/AppError');
const {parseId}=require('../validators/params');
const {cinemaInput,screenInput,seatLayoutInput}=require('../validators/admin-venues');
async function listCinemas(req,res){sendSuccess(res,await service.listCinemas());}
async function createCinema(req,res){sendSuccess(res,{cinema:await service.createCinema(cinemaInput(req.body))},201);}
async function updateCinema(req,res){const x=await service.updateCinema(parseId(req.params.id),cinemaInput(req.body,true));if(!x)throw new AppError(404,'Cinema not found.');sendSuccess(res,{cinema:x});}
async function listScreens(req,res){const x=await service.listScreens(parseId(req.params.cinemaId,'cinemaId'));if(!x)throw new AppError(404,'Cinema not found.');sendSuccess(res,x);}
async function createScreen(req,res){const x=await service.createScreen(parseId(req.params.cinemaId,'cinemaId'),screenInput(req.body).name);if(!x)throw new AppError(404,'Cinema not found.');sendSuccess(res,{screen:x},201);}
async function updateScreen(req,res){const x=await service.updateScreen(parseId(req.params.id),screenInput(req.body).name);if(!x)throw new AppError(404,'Screen not found.');sendSuccess(res,{screen:x});}
async function listSeats(req,res){const x=await service.listSeats(parseId(req.params.screenId,'screenId'));if(!x)throw new AppError(404,'Screen not found.');sendSuccess(res,x);}
async function replaceSeatLayout(req,res){const x=await service.replaceSeatLayout(parseId(req.params.screenId,'screenId'),seatLayoutInput(req.body));sendSuccess(res,{seats:x,total:x.length});}
module.exports={listCinemas,createCinema,updateCinema,listScreens,createScreen,updateScreen,listSeats,replaceSeatLayout};

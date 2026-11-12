const service=require('../services/admin-shows.service');
const {sendSuccess}=require('../utils/response');
const {parseId}=require('../validators/params');
const {showInput,priceInput,statusInput}=require('../validators/admin-shows');
async function listShows(req,res){sendSuccess(res,await service.listShows());}
async function createShow(req,res){sendSuccess(res,{show:await service.createShow(showInput(req.body))},201);}
async function updatePrices(req,res){sendSuccess(res,await service.updatePrices(parseId(req.params.id),priceInput(req.body)));}
async function updateStatus(req,res){sendSuccess(res,await service.updateStatus(parseId(req.params.id),statusInput(req.body)));}
module.exports={listShows,createShow,updatePrices,updateStatus};

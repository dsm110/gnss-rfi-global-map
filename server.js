const http = require('http');
const fs = require('fs');
const path = require('path');
const h3 = require('h3-js');
const zlib = require('zlib');
const root = path.resolve(__dirname);
const cache = new Map();
const port = Number(process.env.PORT) || 8765;
let conflictByDate = {};
try {
  const packed = fs.readFileSync(path.join(root,'global-map-data','ucdp-ged261-by-date.json.gz'));
  conflictByDate = JSON.parse(zlib.gunzipSync(packed)).byDate || {};
  console.log(`Loaded UCDP conflict index for ${Object.keys(conflictByDate).length} dates`);
} catch (error) { console.error('UCDP conflict index unavailable', error.message); }
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8'};
function send(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body)}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function httpJson(url){return new Promise((resolve,reject)=>{const request=http.get(url,{headers:{'User-Agent':'GNSS-RFI-Map/1.0','Accept':'application/json','Connection':'close'}},response=>{if(response.statusCode!==200){response.resume();return reject(new Error(`HTTP ${response.statusCode}`))}let body='';response.setEncoding('utf8');response.on('data',chunk=>body+=chunk);response.on('end',()=>{try{resolve(JSON.parse(body))}catch(error){reject(error)}})});request.setTimeout(20000,()=>request.destroy(new Error('upstream timeout')));request.on('error',reject)})}
async function fetchRemoteJson(url){let lastError;for(let attempt=0;attempt<3;attempt++){try{return await httpJson(url)}catch(error){lastError=error;if(attempt<2)await wait(400*(attempt+1))}}throw lastError}
function rfiGeojson(raw){return {type:'FeatureCollection',features:raw.data.filter(r=>r.totalAircraftCount>=10&&r.lowQualityCount/r.totalAircraftCount>=.02).map(r=>({type:'Feature',properties:{h3Index:r.h3Index,lowQualityCount:r.lowQualityCount,totalAircraftCount:r.totalAircraftCount,ratio:+(r.lowQualityCount/r.totalAircraftCount).toFixed(4)},geometry:{type:'Polygon',coordinates:[h3.cellToBoundary(r.h3Index,true).reverse()]}}))}}
function eventsGeojson(raw){return {type:'FeatureCollection',features:raw.data.filter(e=>Number.isFinite(+e.latitude)&&Number.isFinite(+e.longitude)).map(e=>({type:'Feature',properties:{eventId:e.eventId,startTime:e.startTime,endTime:e.endTime,numFltAffected:e.numFltAffected||0},geometry:{type:'Point',coordinates:[+e.longitude,+e.latitude]}}))}}
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname==='/health')return send(res,200,'ok');
  if(u.pathname==='/api/rfi'){
    const date=u.searchParams.get('date')||'';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return send(res,400,'日期格式应为 YYYY-MM-DD');
    if(!cache.has(date)){
      try{const [y,m,d]=date.split('-');const remote=`http://waas-nas.stanford.edu/data/jamming/${y}/${m}/${d}/heatmap.json`;cache.set(date,rfiGeojson(await fetchRemoteJson(remote)))}catch(e){console.error('Stanford heatmap fetch failed',e);return send(res,502,`无法读取 Stanford 数据：${e.message}`)}
    }
    return send(res,200,JSON.stringify(cache.get(date)),'application/geo+json; charset=utf-8');
  }
  if(u.pathname==='/api/events'){
    const date=u.searchParams.get('date')||'';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return send(res,400,'日期格式应为 YYYY-MM-DD');
    const key=`events-${date}`;
    if(!cache.has(key)){
      try{const [y,m,d]=date.split('-');const remote=`http://waas-nas.stanford.edu/data/jamming/${y}/${m}/${d}/events.json`;cache.set(key,eventsGeojson(await fetchRemoteJson(remote)))}catch(e){console.error('Stanford events fetch failed',e);return send(res,502,`无法读取 Stanford 事件：${e.message}`)}
    }
    return send(res,200,JSON.stringify(cache.get(key)),'application/geo+json; charset=utf-8');
  }
  if(u.pathname==='/api/conflicts'){
    const date=u.searchParams.get('date')||'';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return send(res,400,'日期格式应为 YYYY-MM-DD');
    const features=(conflictByDate[date]||[]).map(e=>({type:'Feature',geometry:{type:'Point',coordinates:[e[0],e[1]]},properties:{id:e[2],type:e[3],deaths:e[4],country:e[5],place:e[6],sideA:e[7],sideB:e[8],start:e[9],end:e[10]}}));
    return send(res,200,JSON.stringify({type:'FeatureCollection',features,source:'UCDP GED 26.1'}),'application/geo+json; charset=utf-8');
  }
  const requested=path.normalize(path.join(root,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname)));
  if(!requested.startsWith(root))return send(res,403,'Forbidden');
  fs.readFile(requested,(err,data)=>err?send(res,404,'Not found'):send(res,200,data,mime[path.extname(requested)]||'application/octet-stream'));
}).listen(port,'0.0.0.0',()=>console.log(`GNSS RFI map listening on port ${port}`));

import {createTrial} from '../shared/nurseryTrial.js';
self.onmessage=e=>{
 try{
  const {design,habitat,sample,runId}=e.data;
  const trial=createTrial(design,habitat,sample,0xae7e00),total=1800;let steps=0;
  const chunk=()=>{
   try{for(let i=0;i<30&&steps<total;i++,steps++)trial.step();
    const snapshot=trial.snapshot();self.postMessage({type:snapshot.ticks>=total?'complete':'progress',runId,...snapshot});
    if(snapshot.ticks<total)setTimeout(chunk,0);
   }catch(error){self.postMessage({type:'failed',runId});}
  };chunk();
 }catch(error){self.postMessage({type:'failed',runId:e.data?.runId});}
};

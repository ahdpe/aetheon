import {LEGACY_GEOMETRY,OCEAN_GEOMETRY} from '../../public/js/shared/habitats.js';

const channels=['nutrients','waste','signal','substrate'];
export const savedGeometry=()=>Object.fromEntries(['version','worldSize','gridSize','cx','cy','radius'].map(k=>[k,OCEAN_GEOMETRY[k]]));
const matches=(a,b)=>a&&Object.keys(savedGeometry()).every(k=>a[k]===b[k]);

// Called only after the original snapshot checksum has been verified. No RNG,
// new bodies or IDs are involved: the old lattice is copied into a larger one.
export function expandSnapshot(original) {
 if(original.worldGeometry){
  if(!matches(original.worldGeometry,savedGeometry()))throw Error('Unsupported saved world geometry');
  return original;
 }
 if(original.formatVersion>=4)throw Error('Missing saved world geometry');
 if(original.geographyState&&original.geographyState.radius!==LEGACY_GEOMETRY.radius)throw Error('Unsupported legacy chamber');
 if(original.fields)for(const key of channels){
  if(typeof original.fields[key]!=='string'||Buffer.from(original.fields[key],'base64').length!==128*128*4)throw Error(`Invalid legacy ${key} field`);
 }
 const data=structuredClone(original),offset=350,padding=32,size=192;
 const shift=p=>{if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Invalid world position during expansion');p.x+=offset;p.y+=offset;};
 for(const p of data.organisms)shift(p);
 for(const p of data.nutrientBlooms??[])shift(p);
 for(const p of data.algaeData?.isles??[])shift(p);
 for(const r of data.nurseryState?.records??[])if(r.position)shift(r.position);
 for(const p of data.cataclysmData?.lazarusOrganisms??[])if(p.x!==undefined||p.y!==undefined)shift(p);
 for(const p of [...(data.vents??[]),...(data.ephemeralFumaroles??[])]){
  p.x+=padding;p.y+=padding;
  if(p.baseX!==undefined)p.baseX+=padding;
  if(p.baseY!==undefined)p.baseY+=padding;
 }
 const embed=(encoded,key)=>{
  const old=Buffer.from(encoded,'base64');if(old.length!==128*128*4)throw Error(`Invalid legacy ${key} field`);
  const values=new Float32Array(size*size);if(key==='nutrients')values.fill(.12);
  const bytes=Buffer.from(values.buffer);
  for(let y=0;y<128;y++)old.copy(bytes,((y+padding)*size+padding)*4,y*128*4,(y+1)*128*4);
  return bytes.toString('base64');
 };
 if(data.fields)for(const key of channels)data.fields[key]=embed(data.fields[key],key);
 else if(data.substrateBase64)data.substrateBase64=embed(data.substrateBase64,'substrate');
 if(data.geographyState){
  for(const s of data.geographyState.samples)s.radius=LEGACY_GEOMETRY.radius;
  data.geographyState.radius=OCEAN_GEOMETRY.radius;
  data.geographyState.expandedAtTick=data.ticks;
 }
 data.worldGeometry=savedGeometry();
 data.expansionState={version:1,tick:data.ticks,from:{...LEGACY_GEOMETRY},to:savedGeometry(),
  translation:{x:offset,y:offset},gridPadding:padding,oldChemicalCellsPreserved:true};
 return data;
}

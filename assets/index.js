(async function(){
  const files=[['data/wetlands_marshes.geojson','eco'],['data/mangroves.geojson','eco'],['data/lagoon_waterbodies.geojson','eco'],['data/coastal_buffer_100m.geojson','eco'],['data/encroachment_2016_2026_smooth.geojson','hot'],['data/encroachment_hotspot_grid.geojson','grid']];
  const cards=document.querySelectorAll('#overviewStats article strong');
  let eco=0,hot=0,grid=0,reports='—';
  for(const [url,type] of files){try{const d=await fetch(url).then(r=>r.json()); if(type==='eco') eco+=d.features.length; if(type==='hot') hot=d.features.length; if(type==='grid') grid=d.features.length;}catch(e){}}
  cards[0].textContent=eco.toLocaleString(); cards[1].textContent=hot.toLocaleString(); cards[2].textContent=grid.toLocaleString();
})();

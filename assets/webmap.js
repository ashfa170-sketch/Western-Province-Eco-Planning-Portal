/* Western Province Eco-Sensitive Areas & Development Pressure
   Client-side map. Data are the supplied GeoJSON layers; public observations come from the published Google Sheet.
*/

const DATASETS=[
 ['admin_boundary.geojson','admin'],['wetlands_marshes.geojson','wetlands'],['mangroves.geojson','mangroves'],
 ['lagoon_waterbodies.geojson','lagoon'],['coastal_buffer_100m.geojson','coastal'],['roads.geojson','roads'],['railways.geojson','railways'],
 ['encroachment_2016_2026_smooth.geojson','hotspots'],['encroachment_hotspot_grid.geojson','grid'],['lulc_change_trajectory.geojson','trajectory']
];
const FORM_BASE='https://docs.google.com/forms/d/e/1FAIpQLSc6rpZf2F5SnUR3QIbdyrpqcMvvxi2za5KKwBjpyGL0_whwGg/viewform?usp=pp_url';
const SHEET_CSV='https://docs.google.com/spreadsheets/d/e/2PACX-1vRuT-AZGMghDvSzHFGcqD7_tWSwfSt5Kkh8Pkx9w4dHUDlcsslFyE4lDCgyziVAqJSWFTThasyoAraV/pub?output=csv';

const C={wetland:'#6F9278',mangrove:'#3F6B57',lagoon:'#4F86A8',coastal:'#A8C6CF',hotspot:'#A64B45',priorityHigh:'#A64B45',priorityModerate:'#C28A3B',priorityLower:'#728B78',pressure:'#7D6A45',report:'#315E7A',roads:'#777B7D',railways:'#9A6A78',boundary:'#263238'};
const CAT={Housing:'#B48A3C',Tourism:'#C56D3B',Industry:'#9B4C4C',Commercial:'#76658D',Other:'#8A9690'};
const LU={'Wetland / Marsh':'#6F9278','Wetland / Semi-Vegetated':'#9BAF9D','Vegetation':'#78966E','Built-Up Area':'#A64B45','Bare / Cleared Land':'#B49A6D','Water':'#4F86A8'};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const num=v=>Number(v||0).toLocaleString(); const ha=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:2});

const map=L.map('map',{zoomControl:false,preferCanvas:true}).setView([6.93,79.92],10);
L.control.zoom({position:'bottomright'}).addTo(map);L.control.scale({metric:true,imperial:false,position:'bottomleft'}).addTo(map);
const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
const sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri World Imagery'});
const renderer=L.canvas({padding:.5});
const layers={
 admin:L.geoJSON(null,{renderer,style:{color:C.boundary,weight:2,dashArray:'6 5',fill:false}}),
 wetlands:L.geoJSON(null,{renderer,style:{color:'#54735D',weight:1,fillColor:C.wetland,fillOpacity:.55}}),
 mangroves:L.geoJSON(null,{renderer,style:{color:'#2E5143',weight:1,fillColor:C.mangrove,fillOpacity:.62}}),
 lagoon:L.geoJSON(null,{renderer,style:{color:'#3C6B86',weight:1,fillColor:C.lagoon,fillOpacity:.42}}),
 coastal:L.geoJSON(null,{renderer,style:{color:'#779BA7',weight:1,fillColor:C.coastal,fillOpacity:.28}}),
 roads:L.geoJSON(null,{renderer,style:{color:C.roads,weight:1.2}}),
 railways:L.geoJSON(null,{renderer,style:{color:C.railways,weight:2,dashArray:'5 4'}}),
 hotspots:L.geoJSON(null,{renderer}),grid:L.geoJSON(null,{renderer}),trajectory:L.geoJSON(null,{renderer}),priority:L.geoJSON(null,{renderer}),
 reports:L.markerClusterGroup({maxClusterRadius:40,showCoverageOnHover:false})
};
const modeGroups={environment:['wetlands','mangroves','lagoon','coastal'],development:['grid','trajectory'],encroachment:['hotspots','priority','reports']};
const modeText={environment:['Environmental sensitivity','Map the places requiring environmental consideration before examining development pressure.'],development:['Development pressure','Compare development concentration with the environmental layers and inspect the historical land-use trajectory.'],encroachment:['Potential encroachment & priorities','Review supplied encroachment evidence, development-pressure priority cells and community observations.']};
const modeState={environment:true,development:false,encroachment:true};
let hotspotFeatures=[],gridFeatures=[],priorityFeatures=[],reportCount=0;

function popup(title,sub,rows,extra=''){return `<div class="map-tip"><div class="popup-title">${title}</div>${sub?`<div class="popup-sub">${sub}</div>`:''}${rows.map(r=>`<div class="popup-row"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('')}${extra}</div>`;}
function bindEco(feature,layer,key){const p=feature.properties||{};let title='Mapped feature',sub='Environmental sensitivity layer';if(key==='wetlands')title='Wetland / marsh';if(key==='mangroves')title='Mangrove';if(key==='lagoon')title=p.name||'Lagoon / waterbody';if(key==='coastal')title='100 m coastal planning buffer';layer.bindPopup(popup(title,sub,[['Dataset feature',p.label||p.natural||p.water||'Mapped feature'],['Source context','Supplied project GIS layer']]));}
function hotspotStyle(feature,layer){const p=feature.properties||{};const risk=p.risk_level||'';const color=risk.includes('High')?C.priorityHigh:risk.includes('Medium')?'#C28A3B':'#7F8E7F';layer.setStyle({color:'#713A36',weight:1,fillColor:color,fillOpacity:.72});layer.bindPopup(popup(`Potential encroachment site`,`${p.enc_type||'Development pressure'} · ${p.period||''}`,[['Area affected',`${ha(p.area_ha)} ha`],['Risk level',p.risk_level||'Not classified'],['Period',p.period||'—']],`<p class="small-note">Spatial evidence supplied for the project. It does not by itself establish illegal or unauthorized development.</p>`));}
function gridPriority(total){const max=gridFeatures.reduce((m,f)=>Math.max(m,Number(f.properties?.total_buildings||0)),0);const q=gridFeatures.map(f=>Number(f.properties?.total_buildings||0)).sort((a,b)=>a-b);const p40=q[Math.floor(q.length*.40)]||0,p75=q[Math.floor(q.length*.75)]||0; if(total>=p75&&p75>0)return 'High';if(total>=p40&&p40>0)return 'Moderate';return 'Lower';}
function gridStyle(feature,layer){const p=feature.properties||{},d=p.dominant_type||'Other';const col=CAT[d]||CAT.Other;layer.setStyle({color:col,weight:.5,fillColor:col,fillOpacity:Number(document.getElementById('gridOpacity').value)});layer.bindPopup(popup('Building pressure cell','500 m analytical cell',[['Structures in influence zone',num(p.total_buildings)],['Housing',num(p.housing)],['Tourism',num(p.tourism)],['Industry',num(p.industry)],['Commercial',num(p.commercial)],['Other / unclassified',num(p.other)],['Building footprint',`${ha(p.footprint_area_ha)} ha`],['Dominant tagged use',p.dominant_type||'Other']],`<p class="small-note">The cell summarises buildings within the project-defined development-influence analysis. It is not a regulatory zoning category.</p>`));}
function priorityFeatureStyle(feature){const p=feature.properties||{},d=p.priority||'Lower';const col=d==='High'?C.priorityHigh:d==='Moderate'?C.priorityModerate:C.priorityLower;return{color:col,weight:1,fillColor:col,fillOpacity:.42};}
function bindPriority(feature,layer){const p=feature.properties||{},d=p.priority||'Lower';layer.bindPopup(popup(`Planning priority: ${d}`,`Analytical screening cell · 500 m`,[['Structures',num(p.total_buildings)],['Dominant use',p.dominant_type||'Other'],['Footprint',`${ha(p.footprint_area_ha)} ha`]],`<p class="small-note">Priority is based on relative development concentration among the supplied pressure cells. It is a screening aid, not a statutory priority zone.</p>`));layer._priority=d;}
function luColor(v){return LU[v]||'#AAB3AE'}
function trajStyle(feature){const idx=Number(document.getElementById('timeSlider').value),key=['lu_2005','lu_2015','lu_2025'][idx],v=feature.properties?.[key];return{color:'#FFFFFF',weight:.35,fillColor:luColor(v),fillOpacity:.62};}
function bindTraj(feature,layer){const p=feature.properties||{};layer.bindPopup(popup('Land-use change record','Compare the supplied classifications across three years',[['2005',p.lu_2005||'—'],['2015',p.lu_2015||'—'],['2025',p.lu_2025||'—']],`<p class="small-note">The slider changes the displayed year. This is a classified trajectory dataset; it should be interpreted with the project’s classification accuracy/validation.</p>`));}
function addData(key,gj){const target=layers[key];if(key==='hotspots'){hotspotFeatures=gj.features||[];L.geoJSON(gj,{onEachFeature:hotspotStyle}).eachLayer(l=>target.addLayer(l));}else if(key==='grid'){gridFeatures=gj.features||[];L.geoJSON(gj,{onEachFeature:gridStyle}).eachLayer(l=>target.addLayer(l));}else if(key==='trajectory'){L.geoJSON(gj,{style:trajStyle,onEachFeature:bindTraj}).eachLayer(l=>target.addLayer(l));}else if(key==='priority'){return;}else{target.addData(gj);if(['wetlands','mangroves','lagoon','coastal'].includes(key))target.eachLayer(l=>bindEco(l.feature,l,key));}}

function applyPriority(){layers.priority.clearLayers();priorityFeatures=gridFeatures.map(f=>({...f,properties:{...f.properties,priority:gridPriority(Number(f.properties?.total_buildings||0))}}));const filter=document.getElementById('prioritySelect').value;priorityFeatures.filter(f=>filter==='all'||f.properties.priority.toLowerCase()===filter).forEach(f=>{const gj={type:'Feature',geometry:f.geometry,properties:f.properties};L.geoJSON(gj,{style:priorityFeatureStyle,onEachFeature:bindPriority}).eachLayer(l=>layers.priority.addLayer(l));});document.getElementById('cnt-priority').textContent=priorityFeatures.length.toLocaleString();}

async function loadAll(){let loaded=0;const pct=document.getElementById('loadPct');for(const [file,key] of DATASETS){try{const gj=await fetch('data/'+file).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});addData(key,gj);const c=document.getElementById('cnt-'+key);if(c)c.textContent=(gj.features||[]).length.toLocaleString();}catch(e){console.warn('Could not load',file,e)}loaded++;pct.textContent=`${loaded} / ${DATASETS.length} datasets`;}applyPriority();updateDashboard();document.getElementById('loadOverlay').style.display='none';updateLegend();}

function setVisible(key,on){if(on)map.addLayer(layers[key]);else map.removeLayer(layers[key]);}
function setMode(mode){document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.getElementById('modeTitle').textContent=modeText[mode][0];document.getElementById('modeText').textContent=modeText[mode][1];document.getElementById('mapModeLabel').textContent=modeText[mode][0];modeGroups[mode].forEach(k=>{const cb=document.querySelector(`[data-layer="${k}"]`);if(cb){cb.checked=true;setVisible(k,true)}});Object.keys(modeGroups).filter(m=>m!==mode).flatMap(m=>modeGroups[m]).forEach(k=>{if(k!=='reports'){const cb=document.querySelector(`[data-layer="${k}"]`);if(cb){cb.checked=false;setVisible(k,false)}}});if(mode==='encroachment'){document.querySelector('[data-layer="reports"]').checked=true;setVisible('reports',true);}updateLegend();}

document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('.layer-item input[data-layer]').forEach(cb=>cb.addEventListener('change',()=>{setVisible(cb.dataset.layer,cb.checked);if(cb.dataset.layer==='trajectory')document.getElementById('timeSliderWrap').classList.toggle('show',cb.checked);updateLegend();}));
document.getElementById('gridOpacity').addEventListener('input',e=>layers.grid.eachLayer(l=>{const p=l.feature?.properties||{};const col=CAT[p.dominant_type]||CAT.Other;l.setStyle({fillColor:col,fillOpacity:Number(e.target.value)})}));
document.getElementById('timeSlider').addEventListener('input',e=>{document.getElementById('yearBadge').textContent=['2005','2015','2025'][e.target.value];layers.trajectory.setStyle(trajStyle);updateLegend()});
document.getElementById('prioritySelect').addEventListener('change',applyPriority);

document.getElementById('btn-osm').onclick=()=>{map.addLayer(osm);map.removeLayer(sat);document.getElementById('btn-osm').classList.add('active');document.getElementById('btn-sat').classList.remove('active')};document.getElementById('btn-sat').onclick=()=>{map.addLayer(sat);map.removeLayer(osm);document.getElementById('btn-sat').classList.add('active');document.getElementById('btn-osm').classList.remove('active')};

document.getElementById('sidebarToggle').onclick=()=>document.getElementById('sidebar').classList.add('open');document.getElementById('closeSidebar').onclick=()=>document.getElementById('sidebar').classList.remove('open');
document.getElementById('legendBtn').onclick=()=>document.getElementById('legend').classList.toggle('show');document.getElementById('dashboardBtn').onclick=()=>{updateDashboard();document.getElementById('dashPanel').classList.toggle('show')};document.querySelectorAll('.panel-close').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).classList.remove('show')));
document.querySelectorAll('.info-btn').forEach(b=>b.addEventListener('click',()=>showInfo(b.dataset.help)));

async function searchPlace(){const q=document.getElementById('placeSearch').value.trim();if(!q)return;try{const res=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(q+', Sri Lanka'),{headers:{'Accept':'application/json'}});const data=await res.json();if(!data.length){alert('Place not found. Try a district, town or landmark name.');return;}const r=data[0];map.setView([Number(r.lat),Number(r.lon)],14);L.marker([Number(r.lat),Number(r.lon)]).addTo(map).bindPopup('<div class="popup-title">'+esc(r.display_name)+'</div><div class="popup-sub">Search result from OpenStreetMap.</div>').openPopup();}catch(e){alert('Search is temporarily unavailable. You can still pan and zoom the map.');}}
document.getElementById('searchBtn').onclick=searchPlace;document.getElementById('placeSearch').addEventListener('keydown',e=>{if(e.key==='Enter')searchPlace();});

document.getElementById('locateBtn').onclick=()=>{if(!navigator.geolocation)return alert('Location is not available in this browser.');navigator.geolocation.getCurrentPosition(pos=>{map.setView([pos.coords.latitude,pos.coords.longitude],14);L.circleMarker([pos.coords.latitude,pos.coords.longitude],{radius:6,color:C.report,fillColor:C.report,fillOpacity:.9}).addTo(map).bindPopup('Your selected location. This is not submitted automatically.').openPopup()},()=>alert('Location access was not granted.'))};

function updateLegend(){let html='';if(document.querySelector('[data-layer="wetlands"]').checked)html+=legendItem(C.wetland,'Wetlands & marshes');if(document.querySelector('[data-layer="mangroves"]').checked)html+=legendItem(C.mangrove,'Mangroves');if(document.querySelector('[data-layer="lagoon"]').checked)html+=legendItem(C.lagoon,'Lagoons / waterbodies');if(document.querySelector('[data-layer="coastal"]').checked)html+=legendItem(C.coastal,'100 m coastal planning buffer');if(document.querySelector('[data-layer="grid"]').checked)html+=legendItem(CAT.Housing,'Building pressure · category colours');if(document.querySelector('[data-layer="hotspots"]').checked)html+=legendItem(C.hotspot,'Potential encroachment site');if(document.querySelector('[data-layer="priority"]').checked)html+=legendItem(C.priorityHigh,'High planning priority')+legendItem(C.priorityModerate,'Moderate planning priority')+legendItem(C.priorityLower,'Lower planning priority');if(document.querySelector('[data-layer="reports"]').checked)html+=legendItem(C.report,'Community report · unverified');document.getElementById('legendContent').innerHTML=html||'<p class="small-note">Turn on a layer to see its legend.</p>';}
function legendItem(color,label){return `<div class="legend-item"><span class="legend-box" style="background:${color}"></span><span>${label}</span></div>`}
function updateDashboard(){const totalHa=hotspotFeatures.reduce((s,f)=>s+Number(f.properties?.area_ha||0),0),buildings=gridFeatures.reduce((s,f)=>s+Number(f.properties?.total_buildings||0),0),high=priorityFeatures.filter(f=>f.properties.priority==='High').length,mod=priorityFeatures.filter(f=>f.properties.priority==='Moderate').length;document.getElementById('dashboardContent').innerHTML=`<div class="summary-grid"><div class="summary-box"><strong>${ha(totalHa)}</strong><span>ha in supplied potential-encroachment sites</span></div><div class="summary-box"><strong>${num(buildings)}</strong><span>structures represented in pressure cells</span></div><div class="summary-box"><strong>${num(high)}</strong><span>high-priority screening cells</span></div><div class="summary-box"><strong>${num(reportCount)}</strong><span>community reports loaded</span></div></div><div class="priority-list"><b style="font-size:11px;color:#53666D">Priority cell distribution</b><div class="priority-row"><span>High</span><div class="bar"><i style="width:${priorityFeatures.length?high/priorityFeatures.length*100:0}%;background:${C.priorityHigh}"></i></div><b>${num(high)}</b></div><div class="priority-row"><span>Moderate</span><div class="bar"><i style="width:${priorityFeatures.length?mod/priorityFeatures.length*100:0}%;background:${C.priorityModerate}"></i></div><b>${num(mod)}</b></div><div class="priority-row"><span>Lower</span><div class="bar"><i style="width:${priorityFeatures.length?(priorityFeatures.length-high-mod)/priorityFeatures.length*100:0}%;background:${C.priorityLower}"></i></div><b>${num(priorityFeatures.length-high-mod)}</b></div></div><p class="small-note">Priority is a transparent analytical screening based on relative building concentration within the supplied pressure cells. It is not a statutory designation.</p>`}

function showInfo(key){const data={environment:['Environmental sensitivity','These layers show mapped environmental features used in the project. They help identify places where development should be examined with greater environmental attention.','Wetlands, mangroves, lagoons/waterbodies and the 100 m coastal planning buffer are separate evidence layers. The coastal buffer is a project-defined reference layer, not automatically a legal setback.'],development:['Development pressure','Development pressure is represented at an aggregated scale to keep the public web map responsive.','The 500 m cells summarise buildings near the mapped sensitive areas by tagged use. The land-use trajectory lets you compare the supplied classifications for 2005, 2015 and 2025.'],encroachment:['Potential encroachment','This interface uses the word potential deliberately. Spatial proximity or overlap does not, by itself, prove an unlawful or unauthorized development.','Use these layers to identify locations for planning attention and further field/authority verification. The priority layer is a screening tool based on relative development concentration.'],reports:['Community reports','Public submissions add local observations that may not appear in the spatial datasets.','Reports are anonymous and displayed as unverified. They can support monitoring and field verification, but should not be treated as confirmed evidence without review.'],reference:['Reference layers','Roads and railways provide context for accessibility and development patterns. The provincial boundary provides geographic orientation.','These are reference layers rather than encroachment indicators by themselves.']};const d=data[key];if(!d)return;document.getElementById('infoTitle').textContent=d[0];document.getElementById('infoContent').innerHTML=`<p>${d[1]}</p><div class="formula">${d[2]}</div>`;document.getElementById('infoPanel').classList.add('show')}

function reportIcon(){return L.divIcon({className:'',html:'<div class="marker-report"></div>',iconSize:[15,15],iconAnchor:[7,7]})}
function loadPublicReports() {

    if (!window.Papa) {
        console.error('PapaParse library is not loaded.');
        return;
    }

    const freshSheetURL = SHEET_CSV + '&t=' + Date.now();

    console.log('Loading community reports from:');
    console.log(freshSheetURL);

    Papa.parse(freshSheetURL, {

        download: true,
        header: true,
        skipEmptyLines: true,

        complete: function(res) {

            console.log('Google Sheet data received:');
            console.log(res.data);

            console.log('Number of rows:', res.data.length);

            if (res.data.length > 0) {
                console.log('First row headings:', Object.keys(res.data[0]));
            }

            layers.reports.clearLayers();

            let n = 0;

            (res.data || []).forEach(function(row) {

                console.log('Processing row:', row);

                const lat = parseFloat(
                    row['latitude'] ||
                    row['Latitude']
                );

                const lng = parseFloat(
                    row['longitude'] ||
                    row['Longitude']
                );

                console.log('Coordinates:', lat, lng);

                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {

                    console.warn(
                        'Skipping row because coordinates are invalid:',
                        row
                    );

                    return;
                }

                const type =
                    row['Encroachment Type'] ||
                    'Environmental observation';

                const description =
                    row['Description'] ||
                    'No description supplied.';

                const area =
                    row['Sensitive Area Type'] ||
                    'Not specified';

                const when =
                    row['Timestamp'] ||
                    'Not specified';

                const html = popup(

                    esc(type),

                    'Community report · <span class="status-tag">Unverified</span>',

                    [
                        ['Sensitive area', area],
                        ['Reported', when]
                    ],

                    `
                    <p style="
                        font-size:11px;
                        line-height:1.5;
                        color:#5E6D73;
                    ">
                        ${esc(description)}
                    </p>

                    <p class="small-note">
                        Community-submitted information.
                        Verification is required before using it
                        as confirmed evidence.
                    </p>
                    `
                );

                L.marker(
                    [lat, lng],
                    {
                        icon: reportIcon()
                    }
                )
                .bindPopup(html)
                .addTo(layers.reports);

                n++;
            });

            reportCount = n;

            document.getElementById(
                'cnt-reports'
            ).textContent = num(n);

            updateDashboard();

            console.log(
                'COMMUNITY REPORTS SUCCESSFULLY LOADED:',
                n
            );
        },

        error: function(error) {

            console.error(
                'COMMUNITY REPORT CSV ERROR:',
                error
            );

            document.getElementById(
                'cnt-reports'
            ).textContent = 'ERROR';
        }
    });
}
map.on('click',e=>{const lat=e.latlng.lat.toFixed(6),lng=e.latlng.lng.toFixed(6),url=`${FORM_BASE}&entry.479157703=${encodeURIComponent(lat)}&entry.1055265949=${encodeURIComponent(lng)}`;L.popup().setLatLng(e.latlng).setContent(`<div class="map-tip"><div class="popup-title">Report this location?</div><div class="popup-sub">Coordinates: ${lat}, ${lng}</div><p class="small-note">Use the public reporting form to submit an anonymous observation.</p><a class="report-link" href="${url}" target="_blank" rel="noopener">Open reporting form →</a></div>`).openOn(map)});

// Keep reports fresh without reloading the page.
loadPublicReports();setInterval(loadPublicReports,120000);loadAll();

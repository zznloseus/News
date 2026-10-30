import {SOURCES} from './sources.mjs';

const provinceRegions=SOURCES.filter(s=>s.source_type==='local')
 .map(s=>s.name.replace(/人民政府$/,'')).filter(n=>n!=='新疆生产建设兵团').sort((a,b)=>b.length-a.length);
const formalMinistries=['人力资源和社会保障部','住房和城乡建设部','国家发展和改革委员会','国家卫生健康委员会','国家金融监督管理总局','国家市场监督管理总局','国家广播电视总局','中国证券监督管理委员会','国家互联网信息办公室'];
const ministries=[...new Set([...formalMinistries.flatMap(n=>[n,'中华人民共和国'+n,n+'办公厅',n+'办公室']),...SOURCES.filter(s=>s.source_type==='ministry').flatMap(s=>{
 const names=[s.name,s.name+'办公厅',s.name+'办公室'];
 if(s.name.endsWith('部'))names.push('中华人民共和国'+s.name);
 return names;
})])].sort((a,b)=>b.length-a.length);
const departments=/^(?:人民政府(?:办公厅|办公室)?|(?:发展和改革|发展改革|经济和信息化|工业和信息化|科学技术|科技|财政|商务|教育|民政|人力资源和社会保障|住房和城乡建设|住房城乡建设|交通运输|自然资源|生态环境|卫生健康|医疗保障|市场监督管理|市场监管|农业农村|应急管理|水利|政务服务和数据管理|政务服务与数据管理|数据|能源|司法|文化和旅游|金融管理|地方金融监督管理)(?:委员会|管理委员会|厅|局|委|办公室)(?:办公厅|办公室)?)$/;
export const ISSUING_RANK={central:0,ministry:1,province:2,'province-department':3,city:4,'city-department':5,county:6,'county-department':7};

function identify(value){
 const issuer=String(value||'').trim().replace(/\s+/g,' ');
 if(/^(?:中共中央(?:办公厅)?(?: 国务院(?:办公厅)?)?|国务院(?:办公厅)?)$/.test(issuer))return {issuer,region:null,issuing_level:'central'};
 let rest=issuer;
 while(rest){const name=ministries.find(m=>rest.startsWith(m));if(!name)break;rest=rest.slice(name.length).replace(/^[\s、，]+/,'');}
 if(issuer&&!rest)return {issuer,region:null,issuing_level:'ministry'};
 const province=provinceRegions.find(p=>issuer.startsWith(p));
 let tail=province?issuer.slice(province.length):issuer,region=province||null,tier=province?'province':null;
 // Recognize explicit geographic prefixes, never borrow the hosting site's location.
 const city=tail.match(/^([\u4e00-\u9fff]{2,12}?(?:自治州|地区|市))(?=人民政府|发展|经济|工业|科学|科技|财政|商务|教育|民政|人力|住房|交通|自然|生态|卫生|医疗|市场|农业|应急|水利|政务|数据|能源|司法|文化|金融|地方金融)/);
 const county=!city&&tail.match(/^([\u4e00-\u9fff]{2,12}?(?:自治县|县|区|旗))(?=人民政府|发展|经济|工业|科学|科技|财政|商务|教育|民政|人力|住房|交通|自然|生态|卫生|医疗|市场|农业|应急|水利|政务|数据|能源|司法|文化|金融|地方金融)/);
 if(city||county){const place=(city||county)[1];region=(province||'')+place;tail=tail.slice(place.length);tier=city?'city':'county';}
 if(region&&departments.test(tail))return {issuer,region,issuing_level:tier+(/^人民政府/.test(tail)?'':'-department')};
 return null;
}
export function policyIdentity(article,version=null){
 const titles=[version?.title,article.title].filter(Boolean);
 const explicit=identify(version?.issuer);
 if(explicit)return explicit;
 for(const title of titles){const prefix=String(title).split(/关于|印发|发布/)[0].trim();const found=identify(prefix);if(found)return found;}
 return {issuer:null,region:null,issuing_level:null};
}
export function higherPolicyLevel(parent,child){
 if(!parent.issuing_level||!child.issuing_level)return null;
 if(ISSUING_RANK[parent.issuing_level]>=ISSUING_RANK[child.issuing_level])return false;
 if(!parent.region||!child.region)return true;
 // Known province-to-province mismatch is not an administrative chain.
 const p=provinceRegions.find(r=>parent.region.startsWith(r)),c=provinceRegions.find(r=>child.region.startsWith(r));
 if(p&&c&&p!==c)return false;
 const cityName=(region,province)=>province?region.slice(province.length)||region:region;
 if(parent.region.endsWith('市')&&child.region.endsWith('市')&&cityName(parent.region,p)!==cityName(child.region,c))return false;
 return true;
}

const central=[
 ['gov','中国政府网','https://www.gov.cn/','综合政策',['https://www.gov.cn/zhengce/zuixin/','https://www.gov.cn/']],
 ['xinhua','新华网','https://www.news.cn/','中央部署',['https://www.news.cn/politics/','https://www.news.cn/fortune/']],
 ['scio','国务院新闻办公室','https://www.scio.gov.cn/','综合政策'],
 ['ndrc','国家发展改革委','https://www.ndrc.gov.cn/','宏观与投资',['https://www.ndrc.gov.cn/xxgk/zcfb/','https://www.ndrc.gov.cn/']],
 ['mof','财政部','https://www.mof.gov.cn/','财税与金融',['https://www.mof.gov.cn/zhengwuxinxi/zhengcefabu/','https://www.mof.gov.cn/']],
 ['pbc','中国人民银行','https://www.pbc.gov.cn/','财税与金融'],
 ['miit','工业和信息化部','https://www.miit.gov.cn/','工业与科技',['https://www.miit.gov.cn/zwgk/zcwj/index.html','https://www.miit.gov.cn/']],
 ['most','科学技术部','https://www.most.gov.cn/','工业与科技'],
 ['mofcom','商务部','https://www.mofcom.gov.cn/','开放与贸易'],
 ['nea','国家能源局','https://www.nea.gov.cn/','能源与环境'],
 ['nda','国家数据局','https://www.nda.gov.cn/','数字经济'],
 ['npc','全国人大','https://www.npc.gov.cn/','法治与监管'],
 ['flk','国家法律法规数据库','https://flk.npc.gov.cn/','法治与监管'],
 ['moj','司法部','https://www.moj.gov.cn/','法治与监管'],
 ['zqyj','司法部公开征求意见系统','https://zqyj.chinalaw.gov.cn/','法治与监管'],
 ['std','全国标准信息公共服务平台','https://std.samr.gov.cn/','法治与监管'],
 ['ccgp','中国政府采购网','https://www.ccgp.gov.cn/','项目与采购'],
 ['ggzy','全国公共资源交易平台','https://www.ggzy.gov.cn/','项目与采购'],
 ['bjggzy','北京市公共资源交易服务平台','https://ggzyfw.beijing.gov.cn/','项目与采购'],
 ['shca','上海市通信管理局','https://shca.miit.gov.cn/','数字经济'],
 ['hljca','黑龙江省通信管理局','https://hljca.miit.gov.cn/','数字经济'],
 ['hunca','湖南省通信管理局','https://hunca.miit.gov.cn/','数字经济'],
 ['sasac','国务院国资委','https://www.sasac.gov.cn/','国资与产业'],
 ['samr','市场监管总局','https://www.samr.gov.cn/','法治与监管'],
 ['cnipa','国家知识产权局','https://www.cnipa.gov.cn/','工业与科技'],
 ['nfra','金融监管总局','https://www.nfra.gov.cn/','财税与金融',['https://www.nfra.gov.cn/cn/static/data/DocInfo/SelectDocByItemUUIdsAndChild/data_itemUUIds=8401%252C8402%252C8403%252C8404%252C8406%252C8409,orderBy=builddate,pageSize=50.json','https://www.nfra.gov.cn/']],
 ['csrc','中国证监会','https://www.csrc.gov.cn/','财税与金融'],
 ['safe','国家外汇管理局','https://www.safe.gov.cn/','财税与金融'],
 ['chinatax','国家税务总局','https://www.chinatax.gov.cn/','财税与金融'],
 ['customs','海关总署','https://www.customs.gov.cn/','开放与贸易'],
 ['mnr','自然资源部','https://www.mnr.gov.cn/','城市与资源'],
 ['mohurd','住房城乡建设部','https://www.mohurd.gov.cn/','城市与资源'],
 ['mwr','水利部','https://www.mwr.gov.cn/','城市与资源'],
 ['mee','生态环境部','https://www.mee.gov.cn/','能源与环境'],
 ['moa','农业农村部','https://www.moa.gov.cn/','农业与粮食'],
 ['lswz','国家粮食和物资储备局','https://www.lswz.gov.cn/','农业与粮食'],
 ['mot','交通运输部','https://www.mot.gov.cn/','交通与物流'],
 ['nhc','国家卫生健康委','https://www.nhc.gov.cn/','医疗与健康'],
 ['nhsa','国家医保局','https://www.nhsa.gov.cn/','医疗与健康'],
 ['nmpa','国家药监局','https://www.nmpa.gov.cn/','医疗与健康'],
 ['moe','教育部','https://www.moe.gov.cn/','教育与民生'],
 ['mohrss','人力资源社会保障部','https://www.mohrss.gov.cn/','教育与民生'],
 ['mca','民政部','https://www.mca.gov.cn/','教育与民生'],
 ['mct','文化和旅游部','https://www.mct.gov.cn/','文化与消费'],
 ['nrta','广电总局','https://www.nrta.gov.cn/','文化与消费'],
 ['cac','中央网信办','https://www.cac.gov.cn/','数字经济'],
 ['fmprc','外交部','https://www.fmprc.gov.cn/','开放与贸易'],
 ['stats','国家统计局','https://www.stats.gov.cn/','宏观与投资'],
 ['audit','审计署','https://www.audit.gov.cn/','执行与监督'],
 ['qstheory','求是网','https://www.qstheory.cn/','中央部署'],
 ['mem','应急管理部','https://www.mem.gov.cn/','安全与应急'],
];
const provinces=[
 ['beijing','北京','https://www.beijing.gov.cn/'],['tianjin','天津','https://www.tj.gov.cn/'],['hebei','河北','https://www.hebei.gov.cn/'],['shanxi','山西','https://www.shanxi.gov.cn/'],['neimenggu','内蒙古','https://www.nmg.gov.cn/'],['liaoning','辽宁','https://www.ln.gov.cn/'],['jilin','吉林','https://www.jl.gov.cn/'],['heilongjiang','黑龙江','https://www.hlj.gov.cn/'],['shanghai','上海','https://www.shanghai.gov.cn/'],['jiangsu','江苏','https://www.jiangsu.gov.cn/'],['zhejiang','浙江','https://www.zj.gov.cn/'],['anhui','安徽','https://www.ah.gov.cn/'],['fujian','福建','https://www.fujian.gov.cn/'],['jiangxi','江西','https://www.jiangxi.gov.cn/'],['shandong','山东','https://www.shandong.gov.cn/'],['henan','河南','https://www.henan.gov.cn/'],['hubei','湖北','https://www.hubei.gov.cn/'],['hunan','湖南','https://www.hunan.gov.cn/'],['guangdong','广东','https://www.gd.gov.cn/'],['guangxi','广西','https://www.gxzf.gov.cn/'],['hainan','海南','https://www.hainan.gov.cn/'],['chongqing','重庆','https://www.cq.gov.cn/'],['sichuan','四川','https://www.sc.gov.cn/'],['guizhou','贵州','https://www.guizhou.gov.cn/'],['yunnan','云南','https://www.yn.gov.cn/'],['xizang','西藏','https://www.xizang.gov.cn/'],['shaanxi','陕西','https://www.shaanxi.gov.cn/'],['gansu','甘肃','https://www.gansu.gov.cn/'],['qinghai','青海','https://www.qinghai.gov.cn/'],['ningxia','宁夏','https://www.nx.gov.cn/'],['xinjiang','新疆','https://www.xinjiang.gov.cn/'],['xpcc','新疆生产建设兵团','https://www.xjbt.gov.cn/']
];
export const SOURCE_TYPES=[
 {id:'media',name:'央媒与理论媒体'},
 {id:'central',name:'中央门户与国家机关'},
 {id:'ministry',name:'部委及直属机构'},
 {id:'local',name:'地方省级政府'},
 {id:'platform',name:'专业公共平台'}
];
const mediaIds=new Set(['xinhua','qstheory']);
const centralIds=new Set(['gov','npc']);
const platformIds=new Set(['flk','zqyj','std','ccgp','ggzy','bjggzy']);
function make(row,level='中央与专业来源'){
 const [id,name,url,category='地方政策',feeds]=row; const host=new URL(url).hostname.replace(/^www\./,'');
 const hosts=[host];if(id==='xinhua')hosts.push('xinhuanet.com');if(id==='fmprc')hosts.push('mfa.gov.cn');if(id==='zqyj')hosts.push('moj.gov.cn');
 const source_type=level==='省级政府'?'local':mediaIds.has(id)?'media':centralIds.has(id)?'central':platformIds.has(id)?'platform':'ministry';
 return {id,name,url,category,level,source_type,hosts,feeds:feeds||[url]};
}
function provinceName(id,name){if(id==='xpcc')return name;const suffix=['beijing','tianjin','shanghai','chongqing'].includes(id)?'市':['neimenggu','guangxi','xizang','ningxia','xinjiang'].includes(id)?({neimenggu:'自治区',guangxi:'壮族自治区',xizang:'自治区',ningxia:'回族自治区',xinjiang:'维吾尔自治区'}[id]):'省';return name+suffix+'人民政府';}
export const SOURCES=[...central.map(row=>make(row)),...provinces.map(([id,name,url])=>make([id,provinceName(id,name),url,'地方政策'],'省级政府'))];
export const CATEGORIES=[...new Set(SOURCES.map(s=>s.category))];
export const SOURCE_MAP=new Map(SOURCES.map(s=>[s.id,s]));

export function matchesSourceTypes(sourceId,params){const selected=params.getAll('source_type');return !selected.length||selected.includes(SOURCE_MAP.get(sourceId)?.source_type);}
export const sourceTypeName=id=>SOURCE_TYPES.find(t=>t.id===SOURCE_MAP.get(id)?.source_type)?.name||'其他来源';

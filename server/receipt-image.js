import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { TYPES } from '../public/schema.js';

const require=createRequire(import.meta.url);
const font=(family,weight)=>readFileSync(require.resolve(`@fontsource/${family}/files/${family}-latin-${weight}-normal.woff`));
const fonts=[{name:'DM Sans',data:font('dm-sans',400),weight:400,style:'normal'},{name:'DM Sans',data:font('dm-sans',700),weight:700,style:'normal'},{name:'Libre Baskerville',data:font('libre-baskerville',400),weight:400,style:'normal'},{name:'Libre Baskerville',data:font('libre-baskerville',700),weight:700,style:'normal'}];
const asset=name=>'data:image/png;base64,'+readFileSync(new URL(`../public/assets/${name}`,import.meta.url)).toString('base64');
const seal=asset('noose-seal.png'),eagle=asset('noose-eagle.png');
const element=(type,style,children,props={})=>({type,props:{...props,style,children}});
const box=(style,children)=>element('div',{display:'flex',...style},children);
const text=(value,style={})=>element('div',{display:'flex',...style},String(value));
const field=(label,value,color='#192d40')=>box({flexDirection:'column',width:'50%',paddingRight:22},[
 text(label.toUpperCase(),{fontSize:11,letterSpacing:.9,color:'#60707e',marginBottom:7}),
 text(value,{fontSize:17,fontWeight:700,color,lineHeight:1.45,wordBreak:'break-word'})
]);

// The exact same PNG is attached to the government message and shown on screen.
// Vector text and the original HD logo are rasterized at 2x for sharp printing.
export async function renderReceiptImage(row){
 const type=TYPES[row.type],number=String(row.number).padStart(6,'0');
 const date=new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(row.created_at));
 const view=box({position:'relative',flexDirection:'column',width:930,padding:'37px 43px 30px',backgroundColor:'#ffffff',color:'#192d40',fontFamily:'DM Sans',border:'1px solid #c9d2db',borderTop:'5px solid #0b2138'},[
  box({position:'absolute',height:5,width:158,right:0,top:-5,backgroundColor:'#a52c3b'},[]),
  box({alignItems:'center',paddingBottom:25,borderBottom:'1px solid #dce2e7'},[
   element('img',{width:84,height:84,objectFit:'contain'},undefined,{src:seal,width:84,height:84}),
   box({flexDirection:'column',marginLeft:22},[
    text('GOVERNMENT OF LOS SANTOS',{fontFamily:'Libre Baskerville',fontWeight:700,fontSize:19}),
    text('Immigration & Civil Affairs',{fontSize:14,color:'#60707e',marginTop:9}),
    text('National Office Of Security Enforcement',{fontSize:14,color:'#60707e',marginTop:4})
   ]),
   box({flexDirection:'column',marginLeft:'auto',textAlign:'right',fontSize:10,letterSpacing:.7,color:'#60707e'},[text('CONFIRMATION'),text('DE DÉPÔT',{marginTop:5})])
  ]),
  text('NUMÉRO DE DOSSIER',{justifyContent:'center',fontSize:12,fontWeight:700,letterSpacing:2.4,marginTop:30,marginBottom:14}),
  text(number,{justifyContent:'center',fontFamily:'Libre Baskerville',fontSize:62,letterSpacing:10,lineHeight:1.2,paddingBottom:31,borderBottom:'1px solid #dce2e7'}),
  box({position:'relative',flexDirection:'column',gap:25,marginTop:27,marginBottom:31},[
   element('img',{position:'absolute',right:0,top:0,width:235,height:220,objectFit:'contain',opacity:.075},undefined,{src:eagle,width:235,height:220}),
   box({},[field('Type de demande',type.title),field('Date de dépôt',date)]),
   box({},[field('Nom',row.payload.lastName),field('Prénom',row.payload.firstName)]),
   box({},[field('État de la demande','Demande enregistrée','#256446'),field('Prochaine étape','Présentation au Gouvernement')])
  ]),
  box({flexDirection:'column',backgroundColor:'#f0f4f5',borderLeft:'3px solid #0b2138',padding:'20px 22px'},[
   text('PROCHAINE ÉTAPE',{fontSize:11,fontWeight:700,letterSpacing:1.2,marginBottom:13}),
   text('Afin de poursuivre votre demande, vous devez désormais vous présenter auprès du Gouvernement de Los Santos. Munissez-vous de votre numéro de dossier et des documents nécessaires à votre démarche.',{fontSize:14,lineHeight:1.8})
  ]),
  box({marginTop:23,justifyContent:'space-between',fontSize:10,color:'#60707e',gap:20},[
   text('Présentez cette confirmation au Gouvernement de Los Santos afin de poursuivre votre démarche.',{maxWidth:700}),text(`NOOSE · ${type.code}`,{whiteSpace:'nowrap'})
  ])
 ]);
 const svg=await satori(view,{width:930,fonts});
 return Buffer.from(new Resvg(svg,{fitTo:{mode:'width',value:1860}}).render().asPng());
}

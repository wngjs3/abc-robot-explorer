"use strict";(()=>{(self.webpackChunk=self.webpackChunk||[]).push([[3277],{14492(C,R,s){s.r(R),s.d(R,{default:()=>pt});var e=s(31085),L=s(88912),Q=s(5433),U=s(91011),I=s(88581),b=s(51319),g=s(98819),k=s(89981),W=s(43557),pe=s(54890),i=s(14041),Z=s(80748),V=s(61919),N=s(28730),Me=s(41955),ge=s(31157),Ae=s(16889),me=s(576),h=s(97999),J=s(74389),$=s(90690),K=s(48149),X=s(47733),q=s(62054),_=s(82812),O=s(37053),ee=s(21936),je=s(29721),ye=s(22664),xe=s(42107),he=s(27307),E=s(41895),z=s(46068),fe=s(87495),T=s(88303),Ie=s(7834),De=s(56746);const ve={Hint:(0,e.jsx)(ye.A,{fontSize:"small"}),Info:(0,e.jsx)(xe.A,{fontSize:"small",color:"info"}),Warning:(0,e.jsx)(he.A,{fontSize:"small",color:"warning"}),Error:(0,e.jsx)(je.A,{fontSize:"small",color:"error"})},Ce=(0,N.n9)()(t=>({listItem:{paddingTop:0,paddingBottom:0,marginBlock:t.spacing(.5)},listItemText:{display:"flex",flexDirection:"row",margin:0,gap:t.spacing(1)},listItemIcon:{alignSelf:"flex-start",minWidth:t.spacing(3)}})),be=({diagnostics:t})=>{const{classes:r}=Ce();return t.length===0?(0,e.jsx)(h.A,{gap:.5,padding:2,children:(0,e.jsx)(I.A,{variant:"body2",color:"text.secondary",children:"No alerts to display."})}):(0,e.jsx)(E.A,{dense:!0,disablePadding:!0,children:t.map(({severity:o,message:p,source:c,startColumn:M,startLineNumber:n},d)=>{const l=Ie.A(De.kJ)[o]??"Error",a=n!=null&&M!=null?`[${n+1},${M+1}]`:"";return(0,e.jsxs)(z.Ay,{className:r.listItem,children:[(0,e.jsx)(fe.A,{className:r.listItemIcon,children:ve[l]}),(0,e.jsx)(T.A,{className:r.listItemText,primary:p,secondary:`${c} ${a}`,slotProps:{secondary:{color:"text.secondary"}}})]},`${p}_${d}`)})})};var Y=s(57297),Ne=s(76081),Te=s(46245);const Se=(0,N.n9)()({list:{height:"100%",overflowY:"auto"}}),we=({logs:t})=>{const[r,o]=(0,i.useState)(!0),{classes:p}=Se(),c=(0,i.useRef)(null);(0,i.useEffect)(()=>{r&&c.current&&(c.current.scrollTop=c.current.scrollHeight)},[r,t]),(0,i.useEffect)(()=>{const d=c.current;function l(a){a.deltaY<0?o(!1):d!=null&&d.scrollHeight-d.scrollTop>d.clientHeight&&o(!0)}return d?.addEventListener("wheel",l),()=>{d?.removeEventListener("wheel",l)}},[]);const M=(0,Te.B)(),n={string:M.base0B,number:M.base09,boolean:M.base09,object:M.base08,undefined:M.base08};return t.length===0?(0,e.jsxs)(h.A,{gap:.5,padding:2,children:[(0,e.jsx)(I.A,{variant:"body2",color:"text.secondary",children:"No logs to display."}),(0,e.jsxs)(I.A,{variant:"body2",color:"text.secondary",children:["Invoke ",(0,e.jsx)("code",{children:"log(someValue)"})," in your Lichtblick Suite node code to see data printed here."]})]}):(0,e.jsx)(E.A,{dense:!0,disablePadding:!0,ref:c,className:p.list,children:t.map(({source:d,value:l},a)=>{const A=l!=null&&typeof l=="object";return(0,e.jsx)(z.Ay,{disablePadding:!0,secondaryAction:(0,e.jsx)(b.A,{underline:"always",variant:"body2",color:"text.secondary",children:d}),children:(0,e.jsx)(Y.A,{children:A?(0,e.jsx)(Ne.Ay,{hideRoot:!0,data:l,invertTheme:!1,theme:M}):(0,e.jsx)(T.A,{primary:l==null||l===!1?String(l):l,slotProps:{primary:{color:n[typeof l]??"text.primary"}}})})},`${a}${d}`)})})},ze=36,Le=(0,N.n9)()(t=>({root:{display:"flex",flexDirection:"column",height:"100%",overflowY:"hidden"},badge:{alignItems:"center",[`.${K.A.badge}`]:{margin:t.spacing(-.25,0,-.25,1),position:"relative",transform:"none",[`&.${K.A.invisible}`]:{display:"none"}}},tabs:{minHeight:ze,position:"relative",bottom:-1,[`.${X.A.root}`]:{minHeight:"auto",minWidth:t.spacing(8),padding:t.spacing(1.5,2),color:t.palette.text.secondary,"&.Mui-selected":{color:t.palette.text.primary}}}})),ke=t=>t.actions,Oe=({diagnostics:t,isSaved:r,logs:o,scriptId:p,onChangeTab:c,save:M})=>{const{classes:n}=Le(),[d,l]=(0,i.useState)("diagnostics"),{clearUserScriptLogs:a}=(0,$.l)(ke),A=(S,j)=>{l(j)},v=()=>{c()};return(0,e.jsx)(e.Fragment,{children:(0,e.jsxs)(q.A,{elevation:0,className:n.root,children:[(0,e.jsx)(k.A,{}),(0,e.jsxs)(h.A,{direction:"row",alignItems:"center",justifyContent:"space-between",gap:1,paddingRight:1,children:[(0,e.jsxs)(_.A,{className:n.tabs,textColor:"inherit",value:d,onChange:A,children:[(0,e.jsx)(O.A,{label:(0,e.jsx)(ee.A,{color:"error",badgeContent:t.length,invisible:t.length===0,className:n.badge,children:"Alerts"}),value:"diagnostics","data-testid":"np-errors",onClick:()=>{v()}}),(0,e.jsx)(O.A,{label:(0,e.jsx)(ee.A,{color:"error",className:n.badge,badgeContent:o.length,invisible:o.length===0,children:"Logs"}),value:"logs","data-testid":"np-logs",onClick:()=>{v()}})]}),(0,e.jsxs)(h.A,{direction:"row",alignItems:"center",gap:.5,fullHeight:!0,children:[d==="logs"&&(0,e.jsx)(g.A,{size:"small",color:"primary",variant:"contained","data-testid":"np-logs-clear",disabled:o.length===0,onClick:()=>{p!=null&&a(p)},children:"Clear logs"}),(0,e.jsx)(g.A,{size:"small",color:"primary",variant:"contained",disabled:r,title:"Ctrl/Cmd + S",onClick:()=>{p!=null&&(M(),a(p))},children:r?"Saved":"Save"})]})]}),(0,e.jsx)(k.A,{}),d==="diagnostics"&&(0,e.jsx)(be,{diagnostics:t}),d==="logs"&&(0,e.jsx)(we,{logs:o})]})})};var Ee=s(77516),Ye=s(56616),te=s(11763),Pe=s(23767),se=s(82966),Be=s(3660),Re=s(75766),We=s(18913),Ze=s(86081),Qe=s(75483);const Ue=(0,N.n9)()(t=>({input:{font:"inherit",padding:t.spacing(1,6,1,2),flexGrow:1,overflow:"hidden",[`.${We.A.input}`]:{padding:0}},listItem:{[`:not(:hover) .${Ze.A.root}`]:{visibility:"hidden"},":focus-within":{backgroundColor:t.palette.action.selected}}}));function Ve({onClick:t,onDelete:r,onRename:o,title:p,selected:c}){const{classes:M}=Ue(),[n,d]=(0,i.useState)(p),[l,a]=(0,i.useState)(!1),A=(0,i.useCallback)(u=>{const D=u.target.value;d(D)},[]),v=(0,i.useCallback)(()=>{a(!0)},[]),S=(0,i.useCallback)(u=>{u.target.select()},[]),j=(0,i.useCallback)(u=>{n!==""&&(u.key==="Escape"?(d(p),a(!1)):u.key==="Enter"&&(a(!1),o(n)))},[n,o,p]),P=(0,i.useCallback)(()=>{n!==""&&(a(!1),o(n),document.activeElement instanceof HTMLElement&&document.activeElement.blur())},[n,o]),y=(0,i.useCallback)(u=>{u.key==="Enter"&&a(!0)},[]);return(0,e.jsx)(z.Ay,{className:M.listItem,disablePadding:!0,secondaryAction:(0,e.jsxs)(e.Fragment,{children:[!l&&(0,e.jsx)(W.A,{size:"small","aria-title":"rename",title:"Rename",onClick:()=>{a(!0)},children:(0,e.jsx)(Be.RIf,{})}),(0,e.jsx)(W.A,{size:"small","aria-title":"delete",title:"Delete",color:"error",onClick:r,children:(0,e.jsx)(Re.aYy,{})})]}),children:l?(0,e.jsx)(T.A,{slotProps:{primary:{variant:"body2"}},children:(0,e.jsx)(Qe.Ay,{autoFocus:!0,fullWidth:!0,onBlur:P,onChange:A,onFocus:S,onKeyDown:j,value:n,className:M.input})}):(0,e.jsx)(Y.A,{selected:c,onClick:t,onKeyDown:y,onDoubleClick:v,children:(0,e.jsx)(T.A,{primary:p,slotProps:{primary:{variant:"body2",noWrap:!0}}})})})}var Ge=s(66703);const G=({title:t,subheader:r,onClose:o})=>(0,e.jsx)(Ge.A,{title:t,slotProps:{title:{variant:"h6"},subheader:{variant:"body2",color:"text.secondary"}},subheader:r,action:(0,e.jsx)(W.A,{size:"small",onClick:o,title:"Collapse",children:(0,e.jsx)(te.p4K,{})})}),Fe=(0,N.n9)()(t=>({buttonRow:{backgroundColor:t.palette.background.paper,padding:t.spacing(1,1.125)}}));function He({scripts:t,addNewScript:r,selectScript:o,deleteScript:p,onClose:c,selectedScriptId:M,selectedScript:n,setUserScripts:d}){const{classes:l}=Fe();return(0,e.jsxs)(h.A,{flex:"auto",children:[(0,e.jsx)(G,{title:"Scripts",onClose:c}),(0,e.jsxs)(E.A,{children:[Object.keys(t).map(a=>(0,e.jsx)(Ve,{title:t[a]?.name??"Untitled script",selected:M===a,onClick:()=>{o(a)},onDelete:()=>{p(a)},onRename:A=>{M!=null&&n!=null&&d({...t,[M]:{...n,name:A}})}},a)),(0,e.jsx)("li",{className:l.buttonRow,children:(0,e.jsx)(g.A,{fullWidth:!0,startIcon:(0,e.jsx)(L.A,{}),variant:"contained",color:"inherit",onClick:()=>{r()},children:"New script"})})]})]})}const Je=[{name:"Skeleton",description:"An empty script",template:`import { Input, Message } from "./types";

type Output = {};

export const inputs = ["/topic"];
export const output = "/studio_script/output_topic";

export default function script(event: Input<"/topic">): Output {
  return {};
};
`},{name:"Markers",description:"A script that publishes one or more markers",template:`// This example shows how to publish a Marker message from a User Script.
//
// Publishing Marker messages with a User Script is a good way to visualize non-visual
// data.
//
// For example, if your robot calculates some projected paths and publishes them between two
// subsystems as a message, you can make a script that visualizes the path as a line list marker and view it in the 3D
// panel.

import { Input, Message } from "./types";

// The \`./markers\` utility provides a helper function to build a Marker.
import { buildRosMarker, MarkerTypes } from "./markers";

type GlobalVariables = { id: number };

export const inputs = ["/input/topic"];
export const output = "/studio_script/my_custom_topic";

// Our script will output a Marker message.
type Marker = Message<"visualization_msgs/Marker">;

// If you want to output multiple markers for a single input message, use a MarkerArray.
// The marker array message has one field, \`markers\`, which is an array of Marker messaages.
// type MarkerArray = Message<"visualization_msgs/MarkerArray">;

export default function script(event: Input<"/input/topic">, globalVars: GlobalVariables): Marker {
  return buildRosMarker({
      // Add any fields you want to set in the marker here
      // Any fields you omit will use default values
      // e.g 'type: MarkerTypes.ARROW' */
  });
};
`},{name:"Multiple Inputs",description:"A script that receives inputs on multiple topics",template:`// This example shows how to subscribe to multiple input topics.
//
// NOTE:
// User Scripts can subscribe to multiple input topics, but can only publish on a single topic.

import { Input } from "./types";

type Output = { topic: string };
type GlobalVariables = { id: number };

// List all the input topics in the \`input\` array
export const inputs = ["/input/topic", "/input/another"];
export const output = "/studio_script/output_topic";

// Make an InputEvent type alias. Since our script will get a message from either input topic, we need to enumerate the topics.
type InputEvent = Input<"/input/topic"> | Input<"/input/another">;

export default function script(event: InputEvent, globalVars: GlobalVariables): Output {
  // Remember that your script will get messages on each topic, so you
  // need to check each event's topic to know which fields are available on the message.
  switch (event.topic) {
    case "/input/topic":
      // topic specific input logic
      // Our message fields are specific to our topic message
      break;
    case "/input/another":
      // another specific logic
      break;
  }

  // Scripts can only output one type of message regardless of the inputs
  // Here we echo back the input topic as an example.
  return {
    topic: event.topic,
  };
};
`},{name:"GPS Location",description:"A script that publishes foxglove.LocationFix",template:`// This example shows how to publish a foxglove.LocationFix message
//
// https://foxglove.dev/docs/studio/messages/location-fix
//
// You can visualize this message with the Map panel
// https://foxglove.dev/docs/studio/panels/map

import { Input } from "./types";
import { LocationFix, PositionCovarianceType } from "@foxglove/schemas";

export const inputs = ["/input/topic"];
export const output = "/studio_script/my_gps";

export default function script(event: Input<"/input/topic">): LocationFix {
  return {
    timestamp: event.receiveTime,
    frame_id: "frame",
    latitude: 51.477928,
    longitude: -0.001545,
    altitude: 0,
    position_covariance_type: PositionCovarianceType.APPROXIMATED,
    position_covariance: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}
`}];function $e({onClose:t,addNewNode:r}){return(0,e.jsxs)(h.A,{flex:"auto",children:[(0,e.jsx)(G,{title:"Templates",subheader:"Create scripts from these templates, click a template to create a new script.",onClose:t}),(0,e.jsx)(E.A,{dense:!0,children:Je.map(({name:o,description:p,template:c})=>(0,e.jsx)(z.Ay,{disablePadding:!0,onClick:()=>{r(c)},children:(0,e.jsx)(Y.A,{children:(0,e.jsx)(T.A,{primary:o,secondary:p,slotProps:{secondary:{variant:"caption"}}})})},o))})]})}var Ke=s(17657);const{utilityFiles:Xe}=(0,Ke.G)();function qe({onClose:t,gotoUtils:r,script:o}){return(0,e.jsxs)(h.A,{flex:"auto",position:"relative",children:[(0,e.jsx)(G,{onClose:t,title:"Utilities",subheader:(0,e.jsxs)(e.Fragment,{children:["You can import any of these modules into your script using the following syntax:"," ",(0,e.jsx)("pre",{children:'import { ... } from "./pointClouds.ts".'})]})}),(0,e.jsxs)(E.A,{dense:!0,children:[Xe.map(({fileName:p,filePath:c})=>(0,e.jsx)(z.Ay,{disablePadding:!0,onClick:r.bind(void 0,c),children:(0,e.jsx)(Y.A,{selected:o?c===o.filePath:void 0,children:(0,e.jsx)(T.A,{primary:p,slotProps:{primary:{variant:"body2"}}})})},c)),(0,e.jsx)(z.Ay,{disablePadding:!0,onClick:r.bind(void 0,"/studio_script/generatedTypes.ts"),children:(0,e.jsx)(Y.A,{selected:o?o.filePath==="/studio_script/generatedTypes.ts":void 0,children:(0,e.jsx)(T.A,{primary:"generatedTypes.ts"})})})]})]})}const _e=(0,N.n9)()(t=>({tabs:{padding:t.spacing(.75),[`.${X.A.root}`]:{minWidth:"auto",minHeight:44,padding:t.spacing(1,1.25)},[`.${Pe.A.indicator}`]:{backgroundColor:(0,V.A)(t.palette.primary.main).setAlpha(t.palette.action.selectedOpacity).toString(),right:0,width:"100%",borderRadius:t.shape.borderRadius,transition:"none",pointerEvents:"none"}},explorerWrapper:{backgroundColor:t.palette.background.paper,width:350,overflow:"auto"}}));function et({userScripts:t,selectScript:r,deleteScript:o,selectedScriptId:p,selectedScript:c,setScriptOverride:M,setUserScripts:n,script:d,addNewScript:l}){const{classes:a}=_e(),[A,v]=(0,i.useState)(!1),S=(0,i.useCallback)(u=>{const D=se.zn.parse(`file://${u}`),m=se.EN.getModel(D);m&&M({filePath:m.uri.path,code:m.getValue(),readOnly:!0,selection:void 0},2)},[M]),j=()=>{v(!1)},P=(0,i.useCallback)((u,D)=>{if(A===D){v(!1);return}v(D)},[A]),y=(0,i.useMemo)(()=>({nodes:(0,e.jsx)(He,{scripts:t,selectScript:r,deleteScript:o,addNewScript:l,onClose:j,selectedScriptId:p,selectedScript:c,setUserScripts:n}),utils:(0,e.jsx)(qe,{onClose:j,gotoUtils:S,script:d}),templates:(0,e.jsx)($e,{onClose:j,addNewNode:l})}),[l,o,S,d,r,c,p,n,t]);return(0,e.jsx)(q.A,{elevation:0,children:(0,e.jsxs)(h.A,{direction:"row",fullHeight:!0,children:[(0,e.jsxs)(_.A,{className:a.tabs,orientation:"vertical",value:A,onChange:P,children:[(0,e.jsx)(O.A,{disableRipple:!0,value:"nodes",title:`Scripts (${Object.keys(t).length})`,icon:(0,e.jsx)(Ee.mAp,{}),"data-testid":"node-explorer",onClick:A==="nodes"?j:void 0}),(0,e.jsx)(O.A,{disableRipple:!0,value:"utils",title:"Utilities",icon:(0,e.jsx)(Ye.eNh,{}),"data-testid":"utils-explorer",onClick:A==="utils"?j:void 0}),(0,e.jsx)(O.A,{disableRipple:!0,value:"templates",title:"Templates",icon:(0,e.jsx)(te.tpQ,{}),"data-testid":"templates-explorer",onClick:A==="templates"?j:void 0})]}),A!==!1&&(0,e.jsxs)(e.Fragment,{children:[(0,e.jsx)(k.A,{flexItem:!0,orientation:"vertical"}),(0,e.jsx)("div",{className:a.explorerWrapper,children:y[A]})]}),(0,e.jsx)(k.A,{flexItem:!0,orientation:"vertical"})]})})}var tt=s(16258),st=s(14041);const nt=st.lazy(async()=>await Promise.all([s.e(6996),s.e(6006),s.e(1092),s.e(1525)]).then(s.bind(s,7198))),ot=`// The ./types module provides helper types for your Input events and messages.
import { Input, Message } from "./types";

// Your script can output well-known message types, any of your custom message types, or
// complete custom message types.
//
// Use \`Message\` to access types from the schemas defined in your data source:
// type Twist = Message<"geometry_msgs/Twist">;
//
// Import from the @foxglove/schemas package to use foxglove schema types:
// import { Pose, LocationFix } from "@foxglove/schemas";
//
// Conventionally, it's common to make a _type alias_ for your script's output type
// and use that type name as the return type for your script function.
// Here we've called the type \`Output\` but you can pick any type name.
type Output = {
  hello: string;
};

// These are the topics your script "subscribes" to. Studio will invoke your script function
// when any message is received on one of these topics.
export const inputs = ["/input/topic"];

// Any output your script produces is "published" to this topic. Published messages are only visible within Studio, not to your original data source.
export const output = "/studio_script/output_topic";

// This function is called with messages from your input topics.
// The first argument is an event with the topic, receive time, and message.
// Use the \`Input<...>\` helper to get the correct event type for your input topic messages.
export default function script(event: Input<"/input/topic">): Output {
  return {
    hello: "world!",
  };
};`,ne=(0,N.n9)()(t=>({emptyState:{backgroundColor:t.palette.background.default},resizeHandle:{position:"relative",height:10,marginTop:-10,":hover":{backgroundPosition:"50% 0",backgroundSize:"100% 50px",backgroundImage:`radial-gradient(${["at center center",`${t.palette.action.focus} 0%`,"transparent 70%","transparent 100%"].join(",")})`,boxShadow:`0 2px 0 0 ${t.palette.mode==="dark"?(0,V.A)(t.palette.divider).lighten().toString():(0,V.A)(t.palette.divider).darken().toString()}`}}}));function it(t){return{general:{fields:{autoFormatOnSave:{input:"boolean",label:"Auto-format on save",value:t.autoFormatOnSave}}}}}const at=({addNewNode:t})=>{const{classes:r}=ne();return(0,e.jsx)(ge.A,{className:r.emptyState,children:(0,e.jsx)(U.A,{maxWidth:"xs",children:(0,e.jsxs)(h.A,{justifyContent:"center",alignItems:"center",gap:1,fullHeight:!0,children:[(0,e.jsxs)(I.A,{variant:"inherit",gutterBottom:!0,children:["Welcome to User Scripts!",(0,e.jsx)("br",{}),"Get started by reading the"," ",(0,e.jsx)(b.A,{color:"primary",underline:"hover",href:"https://foxglove.dev/docs/studio/panels/user-scripts",target:"_blank",children:"docs"}),", or just create a new script."]}),(0,e.jsx)(g.A,{color:"inherit",variant:"contained",onClick:()=>{t()},startIcon:(0,e.jsx)(L.A,{}),children:"New script"})]})})})},rt=Object.freeze({}),lt=t=>t.selectedLayout?.data?.userNodes??rt,ct=t=>t.state;function dt(t){const{config:r,saveConfig:o}=t,{classes:p,theme:c}=ne(),{autoFormatOnSave:M=!1,selectedNodeId:n,editorForStorybook:d}=r,l=(0,tt.gm)(),a=(0,J.Ct)(lt),{scriptStates:A,rosLib:v,typesLib:S}=(0,$.l)(ct),{setUserScripts:j}=(0,J.W$)(),P=(n!=null?A[n]?.diagnostics:void 0)??[],y=n!=null?a[n]:void 0,[u,D]=(0,i.useState)([]),m=u.length>0?u[u.length-1]:void 0,F=!!y&&!!m&&m.filePath===y.name,H=!F||m.code===y.sourceCode,Mt=(n!=null?A[n]?.logs:void 0)??[],[gt,At]=(0,i.useState)(()=>m?m.filePath+(m.readOnly?" (READONLY)":""):"script name"),oe=c.palette.mode==="dark",ie=(0,i.useCallback)(x=>{if(x.action!=="update")return;const{input:f,value:w,path:xt}=x.payload;f==="boolean"&&xt[1]==="autoFormatOnSave"&&o({autoFormatOnSave:w})},[o]);(0,i.useEffect)(()=>{l({actionHandler:ie,nodes:it(r)})},[ie,r,l]),(0,i.useLayoutEffect)(()=>{if(y){const x=t.config.additionalBackStackItems??[];D([{filePath:y.name,code:y.sourceCode,readOnly:!1},...x])}},[t.config.additionalBackStackItems,y]),(0,i.useLayoutEffect)(()=>{At(()=>m?m.filePath+(m.readOnly?" (READONLY)":""):"script name")},[m]);const B=(0,i.useCallback)(()=>{n!=null&&y&&m&&F&&j({[n]:{...y,sourceCode:m.code}})},[m,F,y,n,j]),ae=(0,i.useCallback)(x=>{B();const f=(0,Me.A)(),w=x??ot;j({[f]:{sourceCode:w,name:`${f.split("-")[0]}`}}),o({selectedNodeId:f})},[o,B,j]),re=(0,i.useCallback)(x=>{n==null||x==null||x===""||!y||j({[n]:{...y,sourceCode:x}})},[y,n,j]),le=(0,i.useCallback)((x,f)=>{f!=null&&f>0&&u.length>=f?D([...u.slice(0,f-1),x]):D([...u,x])},[u]),mt=(0,i.useCallback)(()=>{D(u.slice(0,u.length-1))},[u]),jt=(0,i.useCallback)(x=>{const f=[...u];if(f.length>0){const w=f.pop();w&&!w.readOnly&&D([...f,{...w,code:x}])}},[u]),ce=(0,i.useCallback)(()=>{H||B()},[H,B]),de=(0,i.useRef)(ce);de.current=ce,(0,i.useEffect)(()=>()=>{de.current()},[]);const ue=(0,i.useRef)(null),yt=(0,i.useCallback)(()=>{ue.current?.expand()},[]);return(0,e.jsxs)(h.A,{fullHeight:!0,children:[(0,e.jsx)(me.A,{}),(0,e.jsx)(k.A,{}),(0,e.jsxs)(h.A,{direction:"row",fullHeight:!0,overflow:"hidden",children:[(0,e.jsx)(et,{selectScript:x=>{B(),o({selectedNodeId:x})},deleteScript:x=>{j({...a,[x]:void 0}),o({selectedNodeId:Object.keys(a).length>1?Object.keys(a)[0]:void 0})},selectedScriptId:n,userScripts:a,script:m,setScriptOverride:le,setUserScripts:j,selectedScript:y,addNewScript:ae}),(0,e.jsxs)(h.A,{flexGrow:1,fullHeight:!0,overflow:"hidden",style:{backgroundColor:c.palette.background[oe?"paper":"default"]},children:[u.length>1&&(0,e.jsxs)(h.A,{direction:"row",alignItems:"center",gap:1,children:[u.length>1&&(0,e.jsx)(W.A,{title:"Go back","data-testid":"go-back",size:"small",onClick:mt,children:(0,e.jsx)(Q.A,{})}),n!=null&&y&&(0,e.jsx)("div",{style:{position:"relative"},children:gt})]}),(0,e.jsxs)(Z.YZ,{direction:"vertical",children:[n==null&&(0,e.jsx)(at,{addNewNode:ae}),(0,e.jsx)(Z.Zk,{children:(0,e.jsx)(i.Suspense,{fallback:(0,e.jsx)(h.A,{direction:"row",flex:"auto",alignItems:"center",justifyContent:"center",fullHeight:!0,fullWidth:!0,style:{backgroundColor:c.palette.background[oe?"default":"paper"]},children:(0,e.jsx)(pe.A,{size:28})}),children:d??(0,e.jsx)(nt,{autoFormatOnSave:M,script:m,setScriptCode:jt,setScriptOverride:le,rosLib:v,typesLib:S,save:re})})}),(0,e.jsx)(Z.TW,{className:p.resizeHandle}),(0,e.jsx)(Z.Zk,{collapsible:!0,collapsedSize:0,defaultSize:30,style:{minHeight:"38px"},ref:ue,children:(0,e.jsx)(Oe,{diagnostics:P,isSaved:H,logs:Mt,scriptId:n,onChangeTab:yt,save:()=>{re(m?.code)}})})]})]})]})]})}const ut={selectedNodeId:void 0,autoFormatOnSave:!0},pt=(0,Ae.A)(Object.assign(dt,{panelType:"NodePlayground",defaultConfig:ut}))},46245(C,R,s){s.d(R,{B:()=>U,R:()=>Q});var e=s(90389),L=s(26288);function Q(I,b){const g=L.dv[b];if(I==null)return g.null;if(typeof I=="string")return g.string;if(typeof I=="number"||typeof I=="bigint"||typeof I=="boolean")return g.number}function U(){const{palette:{mode:I,text:b}}=(0,e.A)(),g=L.dv[I];return{dark:{base00:"transparent",base0B:g.string,base09:g.number,base07:g.text,base08:g.null,base0D:g.label,base03:b.secondary},light:{base00:"transparent",base0B:g.string,base09:g.number,base07:g.text,base08:g.null,base0D:g.label,base03:b.secondary}}[I]}},68968(C){C.exports="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuMTZEaa/1AAAAHUlEQVQYV2PYvXu3JAi7uLiAMaYAjAGTQBPYLQkAa/0Zef3qRswAAAAASUVORK5CYII="},37584(C){C.exports="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTMiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCA1MyAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgY2xpcC1wYXRoPSJ1cmwoI2NsaXAwKSI+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNDguMDM2NCA0LjAxMDQySDQuMDA3NzlMNC4wMDc3OSAzMi4wMjg2SDQ4LjAzNjRWNC4wMTA0MlpNNC4wMDc3OSAwLjAwNzgxMjVDMS43OTcyMSAwLjAwNzgxMjUgMC4wMDUxODc5OSAxLjc5OTg0IDAuMDA1MTg3OTkgNC4wMTA0MlYzMi4wMjg2QzAuMDA1MTg3OTkgMzQuMjM5MiAxLjc5NzIxIDM2LjAzMTIgNC4wMDc3OSAzNi4wMzEySDQ4LjAzNjRDNTAuMjQ3IDM2LjAzMTIgNTIuMDM5IDM0LjIzOTIgNTIuMDM5IDMyLjAyODZWNC4wMTA0MkM1Mi4wMzkgMS43OTk4NCA1MC4yNDcgMC4wMDc4MTI1IDQ4LjAzNjQgMC4wMDc4MTI1SDQuMDA3NzlaTTguMDEwNDIgOC4wMTMwMkgxMi4wMTNWMTIuMDE1Nkg4LjAxMDQyVjguMDEzMDJaTTIwLjAxODIgOC4wMTMwMkgxNi4wMTU2VjEyLjAxNTZIMjAuMDE4MlY4LjAxMzAyWk0yNC4wMjA4IDguMDEzMDJIMjguMDIzNFYxMi4wMTU2SDI0LjAyMDhWOC4wMTMwMlpNMzYuMDI4NiA4LjAxMzAySDMyLjAyNlYxMi4wMTU2SDM2LjAyODZWOC4wMTMwMlpNNDAuMDMxMiA4LjAxMzAySDQ0LjAzMzlWMTIuMDE1Nkg0MC4wMzEyVjguMDEzMDJaTTE2LjAxNTYgMTYuMDE4Mkg4LjAxMDQyVjIwLjAyMDhIMTYuMDE1NlYxNi4wMTgyWk0yMC4wMTgyIDE2LjAxODJIMjQuMDIwOFYyMC4wMjA4SDIwLjAxODJWMTYuMDE4MlpNMzIuMDI2IDE2LjAxODJIMjguMDIzNFYyMC4wMjA4SDMyLjAyNlYxNi4wMTgyWk00NC4wMzM5IDE2LjAxODJWMjAuMDIwOEgzNi4wMjg2VjE2LjAxODJINDQuMDMzOVpNMTIuMDEzIDI0LjAyMzRIOC4wMTA0MlYyOC4wMjZIMTIuMDEzVjI0LjAyMzRaTTE2LjAxNTYgMjQuMDIzNEgzNi4wMjg2VjI4LjAyNkgxNi4wMTU2VjI0LjAyMzRaTTQ0LjAzMzkgMjQuMDIzNEg0MC4wMzEyVjI4LjAyNkg0NC4wMzM5VjI0LjAyMzRaIiBmaWxsPSIjNDI0MjQyIi8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDAiPgo8cmVjdCB3aWR0aD0iNTMiIGhlaWdodD0iMzYiIGZpbGw9IndoaXRlIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+Cg=="},86060(C){C.exports="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTMiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCA1MyAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgY2xpcC1wYXRoPSJ1cmwoI2NsaXAwKSI+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNDguMDM2NCA0LjAxMDQySDQuMDA3NzlMNC4wMDc3OSAzMi4wMjg2SDQ4LjAzNjRWNC4wMTA0MlpNNC4wMDc3OSAwLjAwNzgxMjVDMS43OTcyMSAwLjAwNzgxMjUgMC4wMDUxODc5OSAxLjc5OTg0IDAuMDA1MTg3OTkgNC4wMTA0MlYzMi4wMjg2QzAuMDA1MTg3OTkgMzQuMjM5MiAxLjc5NzIxIDM2LjAzMTIgNC4wMDc3OSAzNi4wMzEySDQ4LjAzNjRDNTAuMjQ3IDM2LjAzMTIgNTIuMDM5IDM0LjIzOTIgNTIuMDM5IDMyLjAyODZWNC4wMTA0MkM1Mi4wMzkgMS43OTk4NCA1MC4yNDcgMC4wMDc4MTI1IDQ4LjAzNjQgMC4wMDc4MTI1SDQuMDA3NzlaTTguMDEwNDIgOC4wMTMwMkgxMi4wMTNWMTIuMDE1Nkg4LjAxMDQyVjguMDEzMDJaTTIwLjAxODIgOC4wMTMwMkgxNi4wMTU2VjEyLjAxNTZIMjAuMDE4MlY4LjAxMzAyWk0yNC4wMjA4IDguMDEzMDJIMjguMDIzNFYxMi4wMTU2SDI0LjAyMDhWOC4wMTMwMlpNMzYuMDI4NiA4LjAxMzAySDMyLjAyNlYxMi4wMTU2SDM2LjAyODZWOC4wMTMwMlpNNDAuMDMxMiA4LjAxMzAySDQ0LjAzMzlWMTIuMDE1Nkg0MC4wMzEyVjguMDEzMDJaTTE2LjAxNTYgMTYuMDE4Mkg4LjAxMDQyVjIwLjAyMDhIMTYuMDE1NlYxNi4wMTgyWk0yMC4wMTgyIDE2LjAxODJIMjQuMDIwOFYyMC4wMjA4SDIwLjAxODJWMTYuMDE4MlpNMzIuMDI2IDE2LjAxODJIMjguMDIzNFYyMC4wMjA4SDMyLjAyNlYxNi4wMTgyWk00NC4wMzM5IDE2LjAxODJWMjAuMDIwOEgzNi4wMjg2VjE2LjAxODJINDQuMDMzOVpNMTIuMDEzIDI0LjAyMzRIOC4wMTA0MlYyOC4wMjZIMTIuMDEzVjI0LjAyMzRaTTE2LjAxNTYgMjQuMDIzNEgzNi4wMjg2VjI4LjAyNkgxNi4wMTU2VjI0LjAyMzRaTTQ0LjAzMzkgMjQuMDIzNEg0MC4wMzEyVjI4LjAyNkg0NC4wMzM5VjI0LjAyMzRaIiBmaWxsPSIjQzVDNUM1Ii8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDAiPgo8cmVjdCB3aWR0aD0iNTMiIGhlaWdodD0iMzYiIGZpbGw9IndoaXRlIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+Cg=="}}]);})();

//# sourceMappingURL=3277.3522557673180491a975.js.map
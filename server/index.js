import express from 'express';import session from 'express-session';import path from 'path';import {fileURLToPath} from 'url';import {router} from './routes.js';import {config} from './config.js';
const app=express();const __dirname=path.dirname(fileURLToPath(import.meta.url));
app.use(express.json());app.use(session({secret:config.sessionSecret,resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:config.isProd,sameSite:'lax',maxAge:7*24*60*60*1000}}));
app.use('/api',router);
app.use(express.static(path.join(__dirname,'..','dist')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'..','dist','index.html')));
app.listen(config.port,()=>console.log('running',config.port));

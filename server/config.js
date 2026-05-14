import dotenv from 'dotenv';dotenv.config();
export const config={port:Number(process.env.PORT||3000),appsScriptUrl:process.env.APPS_SCRIPT_URL||'',appsScriptToken:process.env.APPS_SCRIPT_TOKEN||'',appLogin:process.env.APP_LOGIN||'',appPassword:process.env.APP_PASSWORD||'',sessionSecret:process.env.SESSION_SECRET||'change-me',isProd:process.env.NODE_ENV==='production'};

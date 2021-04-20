const express = require("express");
const app = express();
const mongoose = require('mongoose');
const config = {
  port: 8080,
  site_url: "https://url.erdem.ovh/", // website url, " / " required 
  mongoDB: process.env.MONGO, // mongodb connection url
  auth: process.env.AUTH // authorization token for line 32
}

mongoose.connect(config.mongoDB, {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false});
const urls = mongoose.model('Url', { url: String, code: String });

generateCode = () =>{ // code generating 
  keys="qwertyuopasdfghjklizxcvbnm1234567890";
  while(true){
    key="";
    for(x = 0; x < 10;x++){
      n = parseInt(Math.random() * 36);
      key+=keys[n].toUpperCase();
    }
    if(!urls.findOne({code: key})) continue;
    return key;
    break;
  }  
}

app.post("/new", (req,res) => {
  code = generateCode();
  if(!req.query.url) return res.status(403).json({code: 403, error: "Unauthorized"});
  if(!req.query.auth) return res.status(403).json({code: 403, error: "Unauthorized"});
  if(req.query.auth !== config.auth) return res.status(403).json({code: 403, error: "Unauthorized"});
  newurl = new urls({url: req.query.url, code: code});
  newurl.save();
  return res.status(200).json({url: config.site_url+code});
});

app.get("/:code", async (req,res) => { // redirect
  if(typeof req.params.code == "null") return res.status(403).json({code: 403, error: "Unauthorized"});
  if(req.params.code == "favicon.ico") return;
  url = await urls.findOne({code: req.params.code});
  if(!url) return res.status(403).json({code: 403, error: "Unauthorized"});
  return res.redirect(url.url);
});

app.get("/", (req,res) => res.redirect("https://replit.com/@erdemsweb/sharex-url-shortener"));
app.get("*", (req,res) => res.status(403).json({code: 403, error: "Unauthorized"}));
app.listen(config.port || 3000);
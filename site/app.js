const express = require('express');
const dotenv = require('dotenv');
const mysql = require('mysql')
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

dotenv.config({ path: './info.env' })

const app = express()
const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
})


db.connect(function(err){
    if(err){
        console.log(err)
    } else {
        console.log("MYSQL Database Connected!")
    }
})







app.set('view engine' , require('ejs')) // for templating


app.use(express.static('public'))
app.use(express.static('public/images'))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// res.render('index.html')











// Redirecting user to different request handlers to keep things organized
app.use('/', require('./routes/pages.js')) // all pages requests
app.use('/post', require('./routes/posts.js')) // all posts requests
app.use('/delete', require('./routes/delete.js')) // all delete requests

// Starting the server
app.listen(3000, function(){
    console.log('Server started on port 3000!')
})
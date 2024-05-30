const { rejects } = require('assert');
const express = require('express');
const mysql = require('mysql');
const { resolve } = require('path');
const bcrypt = require("bcryptjs")
const jwt = require('jsonwebtoken')

const router = express.Router();

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
})





const authentication = function(req, res, next){
    const token = req.cookies.token
    console.log("Token: " + token)
    if(!token){
        return res.redirect('/login')
    }
    jwt.verify(token, process.env.JWT_SECRET, async (err, jwt_result)=>{
        try{
            if(err){
                if(err == 'TokenExpiredError'){
                    return res.redirect('/login')
                }
            } else {
                console.log(err)
            }
        if(jwt_result){
            await db.query("SELECT * FROM users WHERE email = ?", [jwt_result.email], (err, result)=>{
                if(err){
                    console.log(err)
                } else if(result.length > 0){
                    return next()
                } else {
                    return res.redirect('/login')
                }
            })
        }
        } catch(err){
            console.log(err)
        }
    })
}








router.get('/item/:product', authentication,async (req,res) => {
    let token = req.cookies.token
    let product = req.params.product
    let email = await new Promise((resolve, reject) => {
        jwt.verify(token,process.env.JWT_SECRET, (err, decoded) => {
            if(err){
                reject(err)
            } else {
                resolve(decoded.email)
            }            
        })
    })
    
    try{
        await new Promise((resolve,reject) => {
            db.query("DELETE FROM cart WHERE email = ? AND product_name = ?",[email,product], (err,result) => {
                if(err){
                    console.log(err)
                } else {
                    res.redirect('/cart')
                }                
            })
        })
    } catch(err){
        console.log(err)
    }
})


router.get('/account', authentication,async (req,res) => {
    let token = req.cookies.token
    try{
        let email = await new Promise((resolve, reject) => {
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if(err){
                    reject(err)
                } else{
                    resolve(decoded.email)
                }            
            })
        })


        await new Promise((resolve, reject) => {
            // delete user from users
            db.query("DELETE FROM users WHERE email = ?", [email], (err, result) => {
                if(err){
                    reject(err)
                } else{
                    resolve()
                }
            })

            // delete user from cart
            db.query("DELETE FROM cart WHERE email = ?", [email], (err, result) => {
                if(err){
                    reject(err)
                } else{
                    resolve()
                }
            })

            // Clear Cookies
            res.clearCookie('token').redirect('/');


        })




    } catch(err){
        console.log(err)
    }

})





module.exports = router
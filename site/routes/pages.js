const { rejects } = require('assert');
const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const { resolve } = require('path');
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

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






const session_checker = function(req, res, next){
    const token = req.cookies.token
    console.log("Token: " + token)
    if(!token){
        return next()
    }
    jwt.verify(token, process.env.JWT_SECRET, async function(err, result){
        if(err){
            if(err == 'TokenExpiredError'){
                return next();
            }
        } else {
            console.log(err)
        }

        if(result){
            await db.query("SELECT * FROM users WHERE email = ?", [result.email], (err, db_result)=>{
                if(err){
                    console.log(err)
                }
                if(db_result){
                    console.log(db_result)
                    return res.redirect('/') // User can't access the Login and SignUp pages if he/she is already logged in
                } else {
                    return next()
                }
            })
        }
    })
}






router.get('/' , authentication,async (req,res) => {
    const products_array = []
    let i = 1
    while(i<=8){
        
        try {const result = await new Promise((resolve,reject) => {
            db.query("SELECT * FROM products WHERE id = ?", [i],(err,query_result) => {
                if(err){
                    reject(err)
                } else{
                    resolve(query_result[0])
                }
            })
        })
        products_array.push(result)
        i = i + 1
    } catch(err){
        console.log(err)
    }
    }
    let contact_message = req.query.message
    res.render('home.ejs', { products: products_array, contact_message: contact_message })
})





router.get('/signup', session_checker,(req,res)=>{
    res.render('signup.ejs', { message: '' })
})



router.get('/login', session_checker, (req,res)=>{
    res.render('login.ejs', { message: '' })
})

router.get('/details/:product', authentication, async (req,res) => {
    console.log(req.params.product)
    let contact_message = req.query.message
    let product_name = req.params.product
    await db.query("SELECT * FROM products WHERE name = ?", [product_name], (err, result)=>{
        if(err){
            console.log(err)
        } else if( !(result.length > 0) ){
            res.sendStatus(404).send("Product not found")
        }
        let product = result[0]
        res.render('details.ejs', {product: product, contact_message: contact_message })

        console.log(result)
    })
})







router.get("/checkout", authentication, async (req, res) => {
    let products_arr = [];
    let token = req.cookies.token;
    let total = 0;
    let contact_message = req.query.message

    try {
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    resolve(decoded);
                }
            });
        });

        let email = decoded.email;

        const cartResult = await new Promise((resolve, reject) => {
            db.query("SELECT * FROM cart WHERE email = ?", [email], (err, result) => {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });

        for (const item of cartResult) {
            const product = await new Promise((resolve, reject) => {
                db.query("SELECT * FROM products WHERE name = ?", [item.product_name], (err, product) => {
                    if (err) {
                        console.log(err);
                        reject(err);
                    } else {
                        resolve(product[0]);
                    }
                });
            });

            products_arr.push({
                product_name: product.name,
                img: product.img,
                quantity: item.quantity,
                product_total: item.quantity * product.price,
            });

            total = total + item.quantity * product.price;
        }

        // console.log(products_arr);

        res.render('checkout.ejs', {
            products: products_arr,
            total: total,
            contact_message: contact_message
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});





router.get('/cart', authentication, async(req,res) => {
    try{
    let token = req.cookies.token
    let contact_message = req.query.message
    let email = await new Promise((resolve,reject) => {
        jwt.verify(token,process.env.JWT_SECRET, (err, decoded) => {
            if(err){
                reject(err)
            } else{
                resolve(decoded.email)
            }            
        })
    })
    let cart_products = await new Promise((resolve, reject) => {
        db.query("SELECT * FROM cart WHERE email = ?", [email], (err, result) => {
            if(err){
                reject(err)
            } else {
                resolve(result)
            }            
        })
    })
    let products = []
    await Promise.all(cart_products.map(async (product) => {
        return new Promise((resolve, reject) => {
            db.query("SELECT * FROM products WHERE name = ?", [product.product_name], (err, result)=> {
                if(err){
                    reject(err)
                } else {
                    products.push({
                        product_name: result[0].name,
                        img: result[0].img,
                        quantity: product.quantity,
                        product_total: product.quantity * result[0].price,
                    })
                    resolve()
                }            
            })
        })
    }))


    res.render('cart.ejs', { products: products, contact_message: contact_message })
} catch(err){
    console.log(err)
}
})




router.get('/profile', authentication,async (req,res) => {
    let token = req.cookies.token
    let contact_message = req.query.message
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

    let user = await new Promise((resolve, reject) => {
        db.query("SELECT * FROM users WHERE email = ?", [email], (err,result) => {
            if(err){
                reject(err)
            } else {
                resolve(result[0])
            }            
        })
    })


    console.log(user)



    res.render('profile.ejs', { 
        message: '',
        user: user,
        contact_message: contact_message
    })

    } catch(err){
        console.log(err)
    }

})



router.get('/logout', authentication,async (req,res) => {
    res.clearCookie('token').redirect('/login')
})

module.exports = router;
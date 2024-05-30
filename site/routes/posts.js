const { rejects } = require('assert');
const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const { resolve } = require('path');
const bcrypt = require("bcryptjs")
const jwt = require('jsonwebtoken');
const { decode } = require('punycode');
const bodyParser = require('body-parser')

const app = express()

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
})


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

router.post('/signup', async (req,res) => {
    console.log(req.body)

    const {name,username,email,password,confirmpassword} = req.body

    // To check for email existance
    try{
        const email_exists = await new Promise((resolve, reject) => {
            db.query("SELECT email FROM users WHERE email = ?", [email],(err, results)=>{
                if(err){
                    reject(err)
                } else {
                    resolve(results)
                }

            })
        })
        if(email_exists.length > 0){
            return res.render('signup.ejs', { message: 'Email Already in use' })
        }


    // To check for username existance

        const username_exists = await new Promise((resolve, reject) => {
            db.query("SELECT username FROM users WHERE username = ?", [username],(err, results)=>{
                if(err){
                    reject(err)
                } else {
                    resolve(results)
                }

            })
        })
        if(username_exists.length > 0){
            return res.render('signup.ejs', { message: 'Username taken' })
        } else if (password != confirmpassword){
            return res.render("signup.ejs", { message: "Passwords don't match" })
        }
    

    // hashing the password
    let hashedPassword = await bcrypt.hash(password, 8);
    console.log(hashedPassword)


    // Inserting the Data

        new Promise((resolve, reject) => {
            db.query("INSERT INTO users SET ?", {
                name: name,
                username: username,
                email: email,
                password: hashedPassword
            },(err, results)=>{
                if(err){
                    reject(err)
                } else {
                    resolve(results)
                }

            })
        })
        return res.redirect('/login');
    } catch(err){
        console.log(err)
    }

})







router.post('/login', (req,res)=>{
    console.log(req.body)
    const username = req.body.username
    console.log(username)
    const password = req.body.password

    db.query("SELECT * FROM users WHERE username = ?", [username], (err,results) => {
        if(err){
            console.log(err)
        } 
        if(results.length > 0){
            console.log(results)

            let account = results[0]

            let hashedPassword = account.password
            let userId = account.id
            let email = account.email


            bcrypt.compare(password, hashedPassword, (err, result) => {
                if(err){
                    console.log(err)
                }
                if(result == true){
                    const token = jwt.sign({email: email, userId: userId}, process.env.JWT_SECRET, {
                        expiresIn: process.env.JWT_EXPIRES
                    })

                    const cookieOptions = {
                        expiresIn: process.env.COOKIE_EXPIRES,
                        httpOnly: true
                    }
                    //give the user a unique cookie that contains a token which contains some info about user and redirect him to home page.
                    return res.cookie("token", token, cookieOptions).redirect('/');






                } else if(result == false){
                    res.render('login.ejs', { message: 'Incorrect password' })
                }
            })

        } else{
            return res.render('login.ejs', { message: "Username not found" })
        }
    })  

})







router.post("/details/:product", async (req,res)=>{
    console.log(req.body)
    let quantity = req.body.quantity
    let product = req.params.product
    let token = req.cookies.token
    let email
    let DBproduct
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if(err){
            console.log(err)
        }
        email = decoded.email

    })

    DBproduct =  await new Promise((resolve, reject) => {
        db.query("SELECT * FROM cart WHERE email = ? AND product_name = ?", [email, product], (err,result)=>{
            if(err){
                reject(err)
            } else {
                resolve(result)
            }
        })
    })

    console.log(DBproduct)

    if(DBproduct.length > 0){
        db.query("UPDATE cart SET quantity = ? WHERE email = ? AND product_name = ?", [parseInt(DBproduct[0].quantity) + parseInt(quantity), email, product], (err,result) => {
            if(err){
                console.log(err)
            } else{
                res.redirect('/cart')
            }
        })
    } else{
    db.query("INSERT INTO cart SET ?", {
        email: email,
        product_name: product,
        quantity: quantity
    }, (err, result) => {
        if(err){
            console.log(err)
        } else {
            res.redirect("/cart")
        }
    })
    }
    
})


router.post('/checkout', async (req,res) => {
    console.log(req.body)
    let token = req.cookies.token
    try{

        //getting user email from cookie
        let email = await new Promise((resolve, reject) => {
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if(err){
                    reject(err)
                } else{
                    resolve(decoded.email)
                }
            })
        })
        // deleting user's cart items
        await new Promise((resolve, reject) => {
            db.query("DELETE FROM cart WHERE email = ?", [email], (err, result) => {
                if(err){
                    reject(err)
                } else {
                    resolve()
                }
            })
        })

        // redirecting user to home page
        res.redirect('/')

    } catch(err){
        console.log(err)
    }
})



router.post('/cart', async (req,res) => {
    let token = req.cookies.token
    let update_values = req.body
    console.log(update_values)
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




    await Promise.all(
        cartResult.map(async (product) => {
            console.log(product)
            let lower_name = product.product_name.replace(/\s+/g, '_').toLowerCase()
            console.log(update_values[lower_name])
            console.log(product.product_name)
            console.log(email)

            await new Promise((resolve, reject) => {
                db.query("UPDATE cart SET quantity = ? WHERE product_name = ? AND email = ?", [update_values[lower_name], product.product_name, email], (err, result)=> {
                    if(err){
                        reject(err)
                    } else {
                        resolve()
                    }
            }) 
            })
    })
)



    res.redirect('/cart')

    } catch(err){
        console.log(err)
    }
})





router.post('/profile', async (req,res) => {
    console.log(req.body)
    let token = req.cookies.token
    let contact_message = req.query.message
    const {name, username, oldpassword, newpassword,confirmpassword} = req.body

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
        db.query("SELECT * FROM users WHERE email = ?", [email], (err, result)=> {
            if(err){
                reject(err)
            } else{
                resolve(result[0])
            }
        })
    })


    if(username){
        let userExists
        console.log(username == user.username)
        if(username == user.username){
            userExists = false
        } else {

            userExists = await new Promise((resolve,reject) => {
                db.query("SELECT * FROM users WHERE username = ?", [username], (err, result)=>{
                    if(err){
                        reject(err)                
                    } else if(result.length > 0){
                        resolve(true)
                    } else {
                        resolve(false)
                    }
                })
            })
        }
        console.log(userExists)
    if(userExists == false){
        await new Promise((resolve, reject) => {
            db.query("UPDATE users SET username = ?", [username], (err,result)=>{
                if(err){
                    reject(err)
                } else{
                    resolve()
                }
            })
        })


        if(name){
            if(!(name == user.name)){
                await new Promise((resolve, reject) => {
                    db.query("UPDATE users SET name = ?", [name], (err, result)=> {
                        if(err){
                            reject(err)
                        } else{
                            resolve()
                        }
                    })
                })
            }
            }



        if(oldpassword){
                let oldPasswordMatches =  await new Promise((resolve, reject) => {
                    bcrypt.compare(oldpassword, user.password, (err, bool) => {
                        if(err){
                            reject(err)
                        } else{
                            resolve(bool)
                        }
                    })
                })

                if(oldPasswordMatches == true){
                    if(newpassword == confirmpassword) {
                        let hashedPassword = await new Promise((resolve, reject) => {
                            bcrypt.hash(newpassword, 8, (err, result) => {
                                if(err){
                                    reject(err)
                                } else {
                                    resolve(result)
                                }
                            })
                        })

                        await new Promise((resolve, reject) => {
                            db.query("UPDATE users SET password = ? WHERE email = ?", [hashedPassword,email], (err,result)=>{
                                if(err){
                                    reject(err)
                                } else {
                                    resolve()
                                }
                            })
                        })


                    } else {
                        return res.render('profile.ejs', { 
                            message: "New passwords do not match",
                            user: user,
                            contact_message: contact_message
                        })
                    }
                } else {
                    return res.render('profile.ejs', { 
                        message: 'Invalid old password',
                        user: user,
                        contact_message: contact_message
                    })
                }
        }

    } else {
        return res.render('profile.ejs', { 
            message: 'Username taken',
            user: user,
            contact_message: contact_message
        })
    }
    
}

res.render('profile.ejs', {
    message: 'Successful',
    user: user,
    contact_message: contact_message,
});

    } catch(err){
        console.log(err)
    }
})





router.post('/contact', async (req,res) => {
    const referer = req.get('referer')
    const {name,email,message} = req.body

    await new Promise((resolve,reject) => {
        db.query("INSERT INTO contact SET ?", {
            name: name,
            email: email,
            message: message
        }, (err,result) => {
            if(err){
                reject(err)
            } else {
                resolve()
            }
        })
    })
    // send the user back to the same page BUT with a message in the URL Query
    res.redirect(referer + "?message=Thank you for contacting us. We'll reply soon")
})



module.exports = router;
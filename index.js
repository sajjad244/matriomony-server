require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');



// middleware
app.use(cors());
app.use(express.json());

// mongodb connection ___ [--_]

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jdvna.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        // making collections of mongodb
        const db = client.db("matrimony_DB");
        const userCollection = db.collection("user"); // for user collection
        const bioDataCollection = db.collection("bioData"); // for bio data collection
        const favoriteCollection = db.collection("favorite"); // for favorite collection
        const reqPremiumCollection = db.collection("reqPremium"); // for request premium collection
        const paymentsCollection = db.collection("payments"); // for request premium collection
        // making collections of mongodb

        //  ! jwt related api

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '3h' });
            res.send({ token });
        })

        // ? middleWare for checking jwt token ----->>

        const verifyToken = (req, res, next) => {
            // console.log("inside verify token function", req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "unauthorized access" })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(403).send({ message: "forbidden access" })
                }
                req.decoded = decoded;
                next();

            })

        }



        //  ! jwt related api

        // ? making api for user collection if user is already exist or not and also if not exist then make new user

        app.post('/users', async (req, res) => {

            const user = req.body;
            const query = { email: user.email };
            //  check if user is already exist or not
            const isExist = await userCollection.findOne(query);
            if (isExist) {
                return res.send({ message: "user already exist", insertedId: null })
            }
            const result = await userCollection.insertOne({ ...user, role: "customer" });
            res.send(result);
        })

        // ? get all users api from db

        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        // ? get single user api using email from db [for role admin checking ]

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            // ! for own email checking with own token if anyone check other email then it will not allow
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === "admin") {
                isAdmin = true;
            }
            res.send({ isAdmin });
        })

        //? get single user api using email from db [for role premium checking ]

        app.get('/users/premium/:email', async (req, res) => {
            const email = req.params.email;
            // ! for own email checking with own token if anyone check other email then it will not allow
            // if (email !== req.decoded.email) {
            //     return res.status(403).send({ message: "forbidden access" })
            // }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let premium = false;
            if (user?.role === "premium") {
                premium = true;
            }
            res.send({ premium });
        })

        // ?  for making user admin  {updating role}

        app.patch('/users/admin/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: "admin"
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        // ?  for making user premium  {updating role}

        app.patch('/users/premium/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: "premium"
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })



        // ?  for making user premium  {in database requested status update} ---------->>>>

        app.post('/users/premium/request', async (req, res) => {
            try {
                const bioData = req.body;
                const newBioData = {
                    ...bioData,
                    status: "requested",
                };
                const result = await reqPremiumCollection.insertOne(newBioData);
                res.send(result);
            } catch (error) {
                console.error("Error inserting biodata:", error);
                res.status(500).send({ message: "Please wait for Admin approval your data already sent" });
            }
        });

        app.get('/all/approved/req', async (req, res) => {
            const result = await reqPremiumCollection.find().toArray();
            res.send(result);
        })
        // path for admin to approve user
        app.patch('/req/approve', async (req, res) => {
            try {
                const { email } = req.body;

                // Validate email
                if (!email || typeof email !== "string") {
                    return res.status(400).send({ success: false, message: "Invalid email address provided." });
                }

                const filter = { email, status: "requested" };
                const updateDoc = {
                    $set: { status: "approved" },
                };

                // Update multiple documents
                const result = await reqPremiumCollection.updateMany(filter, updateDoc);

                if (result.modifiedCount > 0) {
                    res.status(200).send({ success: true, message: `${result.modifiedCount} requests approved successfully!` });
                } else {
                    res.status(400).send({ success: false, message: "No requests found to approve." });
                }
            } catch (error) {
                console.error("Error approving user:", error);
                res.status(500).send({ success: false, message: "Internal server error." });
            }
        });



        // ?  for making user premium  {in database requested status update} ---------->>>>??




        // !------------>>>



        // ? save bioData api in db and bioDataCollections

        app.post('/bioData', async (req, res) => {
            const bioData = req.body;
            // if user added two form get new id every time
            const lastBioData = await bioDataCollection.findOne({}, { sort: { biodataId: -1 } });
            const newBioDataId = lastBioData ? lastBioData.biodataId + 1 : 1;
            const newBioData = { ...bioData, biodataId: newBioDataId };
            // if user added two form get new id every time
            const result = await bioDataCollection.insertOne(newBioData);
            res.send(result);
        })



        // ? get all bioData api from db

        app.get('/bioDataAll', async (req, res) => {
            const result = await bioDataCollection.find().toArray();
            res.send(result);
        })

        // ? get bioData api from db using email

        app.get('/bioData', async (req, res) => {
            const email = req.query.email;  //for specific user email
            const query = { email: email };
            const result = await bioDataCollection.find(query).toArray();
            res.send(result);
        })

        // ? get bioData using id api from db single data

        app.get('/bioDataAll/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bioDataCollection.findOne(query);
            res.send(result);
        })

        // !----------------- make api for favoriteCollection  ---------------------->>>>

        // ? save favorite api in db and favoriteCollections

        app.post('/favorite', async (req, res) => {
            const favorite = req.body;
            const result = await favoriteCollection.insertOne(favorite);
            res.send(result);
        })

        // ? get all favorite api from db

        app.get('/favoriteAll', async (req, res) => {
            const result = await favoriteCollection.find().toArray();
            res.send(result);
        })

        // ? get favorite api from db using email

        app.get('/favorite/:email', async (req, res) => {
            const email = req.params.email;  //for specific user email
            const query = { email: email };
            const result = await favoriteCollection.find(query).toArray();
            res.send(result);

        })

        // ? delete favorite api from db using id
        app.delete('/favorite/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await favoriteCollection.deleteOne(query);
            res.send(result);
        })


        // ------payment------->>>>>

        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card'],
            })

            res.send({ clientSecret: paymentIntent.client_secret })
        })

        // api for payment

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            res.send(result);
        })

        // ? get all payment api from db

        app.get('/payments', async (req, res) => {
            const result = await paymentsCollection.find().toArray();
            res.send(result);
        })

        // ? update payment api from db using id
        app.patch("/payments/:id", async (req, res) => {
            const { id } = req.params;
            try {
                const result = await paymentsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: "Approved" } }
                );
                if (result.modifiedCount > 0) {
                    res.send({ success: true, message: "Contact request approved!" });
                } else {
                    res.status(404).send({ error: "No request found or already approved" });
                }
            } catch (error) {
                res.status(500).send({ error: "Failed to approve request" });
            }
        });

        // delete 

        app.delete("/payments/:id", async (req, res) => {
            const { id } = req.params;
            try {
                const result = await paymentsCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount > 0) {
                    res.send({ success: true, message: "Contact request deleted!" });
                } else {
                    res.status(404).send({ error: "Contact request not found" });
                }
            } catch (error) {
                res.status(500).send({ error: "Failed to delete contact request" });
            }
        });








        // ------payment------->>>>>




        // ! need to delete

        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// mongodb connection ___ [--_]



// for run the server
app.get('/', (req, res) => {
    res.send('Couple is falling from the sky !!!')
})

app.listen(port, () => {
    console.log(`couple is in love ${port}`)
})



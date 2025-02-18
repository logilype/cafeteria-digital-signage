const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const XMLHttpRequest = require('xhr2');
const fs = require('fs');
const multer = require('multer');
const cookieParser = require("cookie-parser");
const path = require('path');
const setupWebSocket = require('./websocket');
const authRoutes = require('./routes/auth');
const playlistRoutes = require('./routes/playlists');

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/cafds').then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

const app = express();
const server = http.createServer(app);
const port = 3000;
console.log('Initializing server...');

// 1. Essential Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
console.log('Essential middleware initialized');

// 2. Session Configuration
console.log('Setting up session...');
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost/cafds',
        ttl: 24 * 60 * 60
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));
console.log('Session setup complete');

// 3. User Middleware
console.log('Loading user middleware...');
const { loadUser } = require('./middleware/auth');
app.use(loadUser);

// 4. Static Files (after session setup)
console.log('Setting up static file serving...');
app.use('/dashboard/assets', express.static(path.join(__dirname, 'data/dashboard/assets')));
app.use('/dashboard/fonts', express.static(path.join(__dirname, 'data/dashboard/fonts')));
app.use('/dashboard', express.static(path.join(__dirname, 'data/dashboard')));
app.use('/media/fonts', express.static(path.join(__dirname, 'data/fonts')));
app.use('/media', express.static('media'));
app.use(express.static('data'));
console.log('Static paths:', {
    assets: path.join(__dirname, 'data/dashboard/assets'),
    dashboard: path.join(__dirname, 'data/dashboard'),
    media: path.join(__dirname, 'media')
});

// Add error handling for missing files
app.use((err, req, res, next) => {
    console.error('Error serving static file:', req.url);
    console.error('Error details:', err);
    next(err);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/playlists', playlistRoutes);

// 5. Routes
// Authentication pages
app.get('/ui/login', (req, res) => {
    console.log('Login page requested');
    console.log('Session ID:', req.session.userId);
    console.log('Login file path:', path.join(__dirname, 'data/dashboard/login.html'));
    if (req.session.userId) {
        console.log('User already logged in, redirecting to panel');
        return res.redirect('/panel');
    }
    res.sendFile(path.join(__dirname, 'data/dashboard/login.html'));
});

// Dashboard pages
app.get('/panel', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    res.sendFile(path.join(__dirname, 'data/dashboard/panel.html'));
});

app.get('/panel/playlists', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    res.sendFile(path.join(__dirname, 'data/dashboard/playlists.html'));
});

// Root route
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/panel');
    } else {
        res.redirect('/ui/login');
    }
});

// Endpoint to serve settings page
app.get('/panel/settings', (req, res) => {
    if (req.session.userId) {
        res.sendFile(__dirname + '/data/dashboard/settings.html');
    } else {
        res.redirect('/ui/login');
    }
});

// Endpoint to get current settings
app.get('/api/settings', (req, res) => {
    fs.readFile('data/configs/settings.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading settings file:', err);
            return res.status(500).send('Error reading settings');
        }
        const settings = JSON.parse(data);
        // Set defaults if not present
        if (!settings.transitionTime) settings.transitionTime = 5;
        if (!settings.displayTime) settings.displayTime = 5;
        res.json(settings);
    });
});

// Endpoint to update settings
app.post('/api/settings', (req, res) => {
    const updatedSettings = req.body;
    fs.writeFile('data/configs/settings.json', JSON.stringify(updatedSettings, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing settings file:', err);
            return res.status(500).send('Error saving settings');
        }
        res.send('Settings updated successfully');
    });
});

app.get('/getoffers', (req, res) => {
    fs.readFile('data/configs/offers.json', (err, data) => {
        if (err) {
            console.error('Error reading offers:', err);
            return res.status(500).send(err);
        }
        const offers = JSON.parse(data);
        // Log the offers data for debugging
        console.log('Sending offers:', offers);
        const visibleOffers = offers.filter(offer => offer.visibility);
        
        if (visibleOffers.length === 0) {
            return res.send('Keine Angebote verfügbar.');
        }

        fs.readFile('data/offers.html', 'utf8', (err, template) => {
            if (err) {
                return res.status(500).send(err);
            }
            // Add debugging info to the client
            const html = template.replace(
                'var offers = [];', 
                `var offers = ${JSON.stringify(visibleOffers, null, 2)};
                console.log('Loaded offers:', ${JSON.stringify(visibleOffers)});`
            );
            res.send(html);
        });
    });
});

app.get('/getdisplaysequence', (req, res) => {
    res.sendFile(__dirname + '/data/configs/displayseq.json');
    
});

app.get('/news', (req, res) => {
    xmlht = new XMLHttpRequest();
    xmlht.open("GET", "https://www.tagesschau.de/api2/news/?regions=1&ressort=inland", true);
    xmlht.send();
    xmlht.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            //for every news item make a new json object with the title, image, firstSentence and shareurl
            var news = JSON.parse(this.responseText);
            var newsarray = [];
            for (var i = 0; i < 16; i++) {
                var newsitem = {
                    headline: news.news[i].title,
                    image: news.news[i].teaserImage.imageVariants['16x9-1920'],
                    firstsentence: news.news[i].firstSentence,
                    url: news.news[i].shareURL
                };
                newsarray.push(newsitem);
            }
            //send the array as json
            fs.readFile('data/news.html', (err, data) => {
                if (err) {
                    res.send(err);
                };
                replacementdata = data.toString().replace("(datainsertanchor)", JSON.stringify(newsarray));
                res.send(replacementdata);
            });
        }
    };
    
});

app.get('/panel/upload', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    res.sendFile(__dirname + '/data/dashboard/uploadmedia.html');
});
    
app.get('/panel/menu', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    res.sendFile(__dirname + '/data/dashboard/menuedit.html');
});
app.get('/panel/media', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    const mediaDir = path.join(__dirname, 'media');
    
    fs.readdir(mediaDir, (err, files) => {
        if (err) {
            console.error('Error reading media directory:', err);
            return res.status(500).send('Error loading media');
        }

        const imageEntries = files.map(file => `
            <tr>
                <td>${file}</td>
                <td><img src="/media/${file}" alt="${file}" style="width: 100px;"></td>
                <td><button onclick="deleteImage('${file}')">Löschen</button></td>
            </tr>
        `).join('');

        fs.readFile(path.join(__dirname, 'data/dashboard', 'media.html'), 'utf8', (err, html) => {
            if (err) {
                console.error('Error reading media.html:', err);
                return res.status(500).send('Error loading page');
            }

            const updatedHtml = html.replace('(renderanchor)', imageEntries);
            res.send(updatedHtml);
        });
    });
});

app.get('/panel/offers', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    fs.readFile('data/configs/offers.json', (err, data) => {
        if (err) {
            return res.status(500).send(err);
        }
        const menu = JSON.parse(data);
        const entries = menu.map(item => `
            <div class="grid-item">
                <p class="item-name">${item.name}</p>
                <p class="item-price">${item.price.toFixed(2).replace('.', ',')}&nbsp;€</p>
                <div class="image-container">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <p class="item-days">${item.days}</p>
                <p class="item-visibility ${item.visibility ? '' : 'inactive'}">${item.visibility ? 'Wird angezeigt' : 'Wird nicht angezeigt'}</p>
                <div class="buttons">
                    <button type="button" onclick="openEditModal({ id: '${item.id}', name: '${item.name}', price: '${item.price}', image: '${item.image}', days: '${item.days}', visibility: ${item.visibility} })">Bearbeiten</button>
                    <button onclick="deleteEntry(${item.id})">Löschen</button>
                </div>
            </div>
        `).join('');
        
        const html = fs.readFileSync('data/dashboard/offersedit.html', 'utf8').replace('(renderanchor)', entries);
        res.send(html);
    });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        //make directory with id
        
        cb(null, 'media/');
    },
    filename: (req, file, cb) => {
        filename = "/media/" + file.originalname;
        
        cb(null, file.originalname);

    }
});
//limit upload size to 3mb
const limits = {
    fileSize: 3 * 1024 * 1024,
};


const upload = multer({ storage: storage, limits: limits});

app.post('/api/upload', upload.single('file'), (req, res) => {
    res.json({ path: filename });
});


app.get('/panel/offers/new', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    fs.readFile('data/dashboard/newofferentry.html', (err, data) => {
        if (err) {
            res.send(err);
        };
        //index all files in media folder and add them to the dropdown
        fs.readdir('media', (err, files) => {
            if (err) {
                res.send(err);
            };
            var dropdown = "";
            for (var i = 0; i < files.length; i++) {
                dropdown = dropdown + "<option value='" + files[i] + "'>" + files[i] + "</option>";
            }
            replacementdata = data.toString().replace("(allimgs)", dropdown);
            res.send(replacementdata);
        });
    });
});

app.post('/api/newentry', (req, res) => {
    const { name, price, image, days } = req.body;
    const id = makeresultid(10); // Generate a new ID

    // Ensure the image path is correctly prefixed
    const imagePath = image.startsWith('/media/') ? image : `/media/${image}`;

    fs.readFile('data/configs/offers.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading offers.json:', err);
            return res.status(500).send('Error reading offers');
        }

        let offers = JSON.parse(data);
        offers.push({
            id,
            name,
            price,
            image: imagePath, // Use the corrected image path
            days,
            visibility: true // Default visibility to true
        });

        fs.writeFile('data/configs/offers.json', JSON.stringify(offers, null, 2), (err) => {
            if (err) {
                console.error('Error writing to offers.json:', err);
                return res.status(500).send('Error saving new offer');
            }
            res.send("success");
        });
    });
});


app.post('/api/editentry', (req, res) => {
    var id = req.body.id;
    var name = req.body.name;
    var price = req.body.price;
    var image = req.body.image; // Get the image path directly from the request
    var days = req.body.days;
    var visibility = req.body.visibility; // Get the visibility state from the request

    // Log the received data
    console.log("Received data:", req.body);

    // Edit entry in offers.json with the id from the parameters
    fs.readFile('data/configs/offers.json', (err, data) => {
        if (err) {
            return res.status(500).send(err); // Send error response if reading fails
        }
        var menu = JSON.parse(data);
        for (var i = 0; i < menu.length; i++) {
            if (menu[i].id == id) {
                menu[i].name = name;
                menu[i].price = price;
                menu[i].image = image; // Save the image path directly
                menu[i].days = days;
                menu[i].visibility = visibility; // Save the visibility state
                fs.writeFile('data/configs/offers.json', JSON.stringify(menu, null, 2), (err) => {
                    if (err) {
                        return res.status(500).send(err); // Send error response if writing fails
                    }
                    res.send("success"); // Send success response
                });
                return;
            }
        }
        res.send("error"); // Send error if id not found
    });
});

app.post('/api/deleteoffer', (req, res) => {
    const id = req.body.id;
    console.log('Request body:', req.body);
    console.log(`Received request to delete entry with id: ${id}`);

    fs.readFile('data/configs/offers.json', (err, data) => {
        if (err) {
            console.error('Error reading offers.json:', err);
            return res.status(500).send(err);
        }

        let menu = JSON.parse(data);
        const initialLength = menu.length;
        menu = menu.filter(item => String(item.id) !== String(id));
        console.log(`Entries before deletion: ${initialLength}, after deletion: ${menu.length}`);

        fs.writeFile('data/configs/offers.json', JSON.stringify(menu, null, 2), (err) => {
            if (err) {
                console.error('Error writing to offers.json:', err);
                return res.status(500).send(err);
            }
            res.send("success");
        });
    });
});

app.get('/api/getImages', (req, res) => {
    fs.readdir('media', (err, files) => {
        if (err) {
            console.error('Error reading media directory:', err);
            return res.status(500).send(err);
        }
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif)$/.test(file));
        const imagePaths = imageFiles.map(file => `/media/${file}`); // Create full paths
        res.json(imagePaths); // Send the list of image paths as JSON
    });
});

app.post('/api/deleteimage', (req, res) => {
    const imageName = req.body.name;
    const imagePath = path.join(__dirname, 'media', imageName);

    fs.unlink(imagePath, (err) => {
        if (err) {
            console.error('Error deleting image:', err);
            return res.status(500).send('Error deleting image'); // Ensure response is sent only once
        }
        res.send('Image deleted successfully');
    });
});

app.get('/panel/menuentries', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    res.sendFile(path.join(__dirname, 'data/dashboard', 'menuentries.html'));
});

app.get('/api/menuentries', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    // If valid, read the menuentries.json file
    fs.readFile('data/configs/menuentries.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading menuentries.json:', err);
            return res.status(500).send('Error reading menu entries');
        }
        // Send the parsed JSON data as a response
        res.json(JSON.parse(data));
    });
});

app.post('/api/editmenuentry', (req, res) => {
    const { id, name, category, price } = req.body;

    fs.readFile('data/configs/menuentries.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading menuentries.json:', err);
            return res.status(500).send('Error reading menu entries');
        }

        let menuEntries = JSON.parse(data);
        const entryIndex = menuEntries.findIndex(entry => entry.id === id);

        if (entryIndex !== -1) {
            menuEntries[entryIndex] = { ...menuEntries[entryIndex], name, category, price };
            fs.writeFile('data/configs/menuentries.json', JSON.stringify(menuEntries, null, 2), (err) => {
                if (err) {
                    console.error('Error writing to menuentries.json:', err);
                    return res.status(500).send('Error updating menu entry');
                }
                res.send("success");
            });
        } else {
            res.status(404).send('Entry not found');
        }
    });
});

app.post('/api/newmenuentry', (req, res) => {
    const { name, category, price } = req.body;
    const id = makeresultid(6); // Generate a new ID

    fs.readFile('data/configs/menuentries.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading menuentries.json:', err);
            return res.status(500).send('Error reading menu entries');
        }

        let menuEntries = JSON.parse(data);
        menuEntries.push({ id, name, category, price });

        fs.writeFile('data/configs/menuentries.json', JSON.stringify(menuEntries, null, 2), (err) => {
            if (err) {
                console.error('Error writing to menuentries.json:', err);
                return res.status(500).send('Error saving new menu entry');
            }
            res.send("success");
        });
    });
});

// Setup WebSocket
const ws = setupWebSocket(server);
app.set('ws', ws); // Make WebSocket available to routes

server.listen(port, () => {
    console.log(`
    Server initialized:
    - Port: ${port}
    - Environment: ${process.env.NODE_ENV || 'development'}
    - MongoDB URL: ${process.env.MONGODB_URI || 'mongodb://localhost/cafds'}
    - Static files root: ${path.join(__dirname, 'data')}
    `);
});

app.post('/api/deletemenuentry', (req, res) => {
    const id = req.body.id;
    console.log('Request body:', req.body);
    console.log(`Received request to delete entry with id: ${id}`);

    fs.readFile('data/configs/menuentries.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading menuentries.json:', err);
            return res.status(500).send('Error reading menu entries');
        }

        let menuEntries = JSON.parse(data);
        const initialLength = menuEntries.length;
        menuEntries = menuEntries.filter(entry => entry.id !== id);

        console.log(`Entries before deletion: ${initialLength}, after deletion: ${menuEntries.length}`);

        if (menuEntries.length === initialLength) {
            return res.status(404).send('Entry not found');
        }

        fs.writeFile('data/configs/menuentries.json', JSON.stringify(menuEntries, null, 2), (err) => {
            if (err) {
                console.error('Error writing to menuentries.json:', err);
                return res.status(500).send('Error deleting menu entry');
            }
            res.send("success");
        });
    });
});

app.get('/panel/menuentries/new', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    res.sendFile(path.join(__dirname, 'data/dashboard', 'newmenuentry.html'));
});

app.get('/api/cafeteriaMenuEntries', (req, res) => {
    fs.readFile('data/configs/menuentries.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading menuentries.json:', err);
            return res.status(500).send('Error reading menu entries');
        }

        const menuEntries = JSON.parse(data);
        const cafeteriaEntries = menuEntries.filter(entry => entry.category === "Cafeteria Menü");
        res.json(cafeteriaEntries);
    });
});

app.get('/api/dessertEntries', (req, res) => {
    fs.readFile('data/configs/menuentries.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading menuentries.json:', err);
            return res.status(500).send('Error reading menu entries');
        }
        const menuEntries = JSON.parse(data);
        const dessertEntries = menuEntries.filter(entry => entry.category === "Dessert");
        res.json(dessertEntries);
    });
});

app.post('/api/saveMenuSelections', (req, res) => {
    const selectedOptions = req.body;
    console.log('Received menu selections:', selectedOptions);

    fs.writeFile('data/configs/menuSelections.json', JSON.stringify(selectedOptions, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing menu selections file:', err);
            return res.status(500).send('Error saving menu selections');
        }
        res.send('Ausgewählte Speiseplaneinträge erfolgreich gespeichert. Nachdem Sie auf OK klicken, lädt sich die Seite neu');
    });
});

app.get('/api/getMenuSelections', (req, res) => {
    fs.readFile('data/configs/menuSelections.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading menu selections file:', err);
            return res.status(500).send('Error loading menu selections');
        }
        res.json(JSON.parse(data));
    });
});

// Endpoint to get salat entries
app.get('/api/salatEntries', (req, res) => {
    fs.readFile('data/configs/menuentries.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading menuentries.json:', err);
            return res.status(500).send('Error reading menu entries');
        }
        const menuEntries = JSON.parse(data);
        const salatEntries = menuEntries.filter(entry => entry.category === "Salat");
        res.json(salatEntries);
    });
});

app.get('/api/offers', (req, res) => {
    fs.readFile('data/configs/offers.json', (err, data) => {
        if (err) {
            console.error('Error reading offers.json:', err);
            return res.status(500).send('Error reading offers');
        }
        res.json(JSON.parse(data));
    });
});

// Add or update these endpoints

// Get offers
app.get('/api/getoffers', (req, res) => {
    fs.readFile('data/configs/offers.json', (err, data) => {
        if (err) {
            return res.status(500).send(err);
        }
        const offers = JSON.parse(data);
        const visibleOffers = offers.filter(offer => offer.visibility);
        res.json(visibleOffers);
    });
});

// Edit offer
app.post('/api/editentry', (req, res) => {
    const updatedOffer = req.body;
    
    fs.readFile('data/configs/offers.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading offers.json:', err);
            return res.status(500).send('Error reading offers');
        }

        let offers = JSON.parse(data);
        const index = offers.findIndex(offer => offer.id === updatedOffer.id);
        
        if (index !== -1) {
            offers[index] = updatedOffer;
            
            fs.writeFile('data/configs/offers.json', JSON.stringify(offers, null, 2), (err) => {
                if (err) {
                    console.error('Error writing offers.json:', err);
                    return res.status(500).send('Error updating offer');
                }
                res.send('success');
            });
        } else {
            res.status(404).send('Offer not found');
        }
    });
});

// Delete offer
app.post('/api/deleteoffer', (req, res) => {
    const { id } = req.body;
    
    fs.readFile('data/configs/offers.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading offers.json:', err);
            return res.status(500).send('Error reading offers');
        }

        let offers = JSON.parse(data);
        const filteredOffers = offers.filter(offer => offer.id !== id);
        
        if (filteredOffers.length === offers.length) {
            return res.status(404).send('Offer not found');
        }

        fs.writeFile('data/configs/offers.json', JSON.stringify(filteredOffers, null, 2), (err) => {
            if (err) {
                console.error('Error writing offers.json:', err);
                return res.status(500).send('Error deleting offer');
            }
            res.send('success');
        });
    });
});

// Add this new endpoint for the admin panel
app.get('/api/getadminoffers', (req, res) => {
    fs.readFile('data/configs/offers.json', (err, data) => {
        if (err) {
            return res.status(500).send(err);
        }
        // Just send the parsed JSON data directly
        res.json(JSON.parse(data));
    });
});

// Update the dashboard stats endpoint
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        // Read all necessary files
        const [offersData, menuEntriesData, advertisementsData] = await Promise.all([
            fs.promises.readFile('data/configs/offers.json', 'utf8'),
            fs.promises.readFile('data/configs/menuentries.json', 'utf8'),
            fs.promises.readFile('data/configs/advertisements.json', 'utf8')
        ]);

        // Parse JSON data
        const offers = JSON.parse(offersData);
        const menuEntries = JSON.parse(menuEntriesData);
        const advertisements = JSON.parse(advertisementsData);

        // Calculate statistics
        const stats = {
            activeOffers: offers.filter(offer => offer.visibility).length,
            menuEntries: menuEntries.length,
            activeAds: advertisements.filter(ad => ad.enabled).length
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        // If advertisements.json doesn't exist yet, return 0 active ads
        if (error.code === 'ENOENT') {
            const stats = {
                activeOffers: 0,
                menuEntries: 0,
                activeAds: 0
            };
            return res.json(stats);
        }
        res.status(500).json({ error: 'Error fetching dashboard statistics' });
    }
});

// Endpoint to serve advertisement content
app.get('/api/advertisement', (req, res) => {
    fs.readFile('data/configs/advertisement.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading advertisement file:', err);
            return res.status(500).send('Error reading advertisement');
        }
        res.json(JSON.parse(data));
    });
});

// Update the advertisement endpoint to handle both new and edit requests
app.post('/api/advertisement', (req, res) => {
    const { id, header, image, description, enabled } = req.body;
    
    fs.readFile('data/configs/advertisements.json', 'utf8', (err, data) => {
        let advertisements = [];
        if (!err) {
            advertisements = JSON.parse(data);
        }

        if (id) {
            // Edit existing advertisement
            const index = advertisements.findIndex(ad => ad.id === id);
            if (index !== -1) {
                advertisements[index] = { id, header, image, description, enabled };
            }
        } else {
            // Create new advertisement
            const newAd = {
                id: Date.now().toString(), // Generate new ID
                header,
                image,
                description,
                enabled: enabled || false
            };
            advertisements.push(newAd);
        }

        fs.writeFile('data/configs/advertisements.json', JSON.stringify(advertisements, null, 2), 'utf8', (err) => {
            if (err) {
                console.error('Error saving advertisement:', err);
                return res.status(500).send('Error saving advertisement');
            }
            res.send('Advertisement saved successfully');
        });
    });
});

app.get('/panel/advertising', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    res.sendFile(__dirname + '/data/dashboard/advertising.html');
});

// Also add an endpoint to get list of media files for the dropdown
app.get('/api/media', (req, res) => {
    const mediaDir = path.join(__dirname, 'media');
    fs.readdir(mediaDir, (err, files) => {
        if (err) {
            console.error('Error reading media directory:', err);
            return res.status(500).send('Error reading media files');
        }
        // Filter for image files if needed
        const imageFiles = files.filter(file => 
            file.endsWith('.jpg') || 
            file.endsWith('.jpeg') || 
            file.endsWith('.png') || 
            file.endsWith('.gif')
        );
        res.json(imageFiles);
    });
});

// Get all advertisements
app.get('/api/advertisements', (req, res) => {
    fs.readFile('data/configs/advertisements.json', 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.json([]);
            }
            return res.status(500).send('Error reading advertisements');
        }
        res.json(JSON.parse(data));
    });
});

// Delete advertisement
app.post('/api/advertisement/delete', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }

    const { id } = req.body;
    
    fs.readFile('data/configs/advertisements.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading advertisements file:', err);
            return res.status(500).send('Error reading advertisements');
        }

        let ads = JSON.parse(data);
        ads = ads.filter(ad => ad.id !== id);

        fs.writeFile('data/configs/advertisements.json', JSON.stringify(ads, null, 2), 'utf8', (err) => {
            if (err) {
                console.error('Error writing advertisements file:', err);
                return res.status(500).send('Error deleting advertisement');
            }
            res.send('Advertisement deleted successfully');
        });
    });
});

// Add route for new advertisement page
app.get('/panel/advertising/new', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/ui/login');
    }
    res.sendFile(__dirname + '/data/dashboard/newadvertisement.html');
});

// Add route for public offers display
app.get('/offers', (req, res) => {
    res.sendFile(path.join(__dirname, 'data/offers.html'));
});

// Add API route for getting offers data
app.get('/api/getoffers', (req, res) => {
    fs.readFile('data/configs/offers.json', (err, data) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(JSON.parse(data));
    });
});

// Add or update media serving middleware
app.use('/media', express.static('media'));

// Also ensure images can be accessed from the dashboard
app.use('/dashboard/assets', express.static(path.join(__dirname, 'data/dashboard/assets')));

// Add these routes for navbar
app.get('/dashboard/js/navbar.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'data/dashboard/js/navbar.js'));
});

app.get('/dashboard/config/navbar.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'data/dashboard/config/navbar.json'));
});

// Authentication middleware
function checkAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/ui/login');
    }
}

// Add allergies routes
app.get('/panel/allergies', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'data/dashboard/editallergies.html'));
});

app.get('/api/allergies', checkAuth, (req, res) => {
    const allergiesPath = path.join(__dirname, 'data/allergies.json');
    if (fs.existsSync(allergiesPath)) {
        res.json(JSON.parse(fs.readFileSync(allergiesPath)));
    } else {
        res.json({}); // Return empty object if no allergies set
    }
});

app.post('/api/editallergy', checkAuth, (req, res) => {
    const allergiesPath = path.join(__dirname, 'data/allergies.json');
    let allergies = {};
    
    if (fs.existsSync(allergiesPath)) {
        allergies = JSON.parse(fs.readFileSync(allergiesPath));
    }
    
    const { key, description } = req.body;
    allergies[key] = description;
    
    fs.writeFileSync(allergiesPath, JSON.stringify(allergies, null, 4));
    res.sendStatus(200);
});

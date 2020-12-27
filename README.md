## NODE.JS PayUBiz Kit
----------------

### Files/Folders required:-
```
|-- payubiz_nodejs-master
    |-- .gitignore
    |-- Readme.md
    |-- checkout.html
    |-- package-lock.json
    |-- package.json
    |-- response.html
    |-- server.js
    |-- images
        |-- logo.png
```

### npm packages used:
- express
- express-session
- body-parser
- path
- crypto
- request
- ejs


### Getting Started
Copy `.env.example` to `.env` with correct credentials
 ```
 cp .env.example .env

 npm install

 npm run start / node server.js / node server

 ```

Server URL and PORT :- http://localhost:3000

** Run server with 'node server' command. Open browser and type 'localhost:3000'.


### Test Cards
```

Card Name: Any name
Card Number: 5123 4567 8901 2346
CVV: 123
Expiry: May 2021

Card Name: Any name
Card Number: 4012 0010 3714 1112
CVV: 123
Expiry: May 2021

```

### OTP Page
Please OTP as `123456` when prompted to input the OTP, on the OTP simulator page.
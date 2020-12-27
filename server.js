/*
Note : It is recommended to fetch all the parameters from your Database rather than posting static values or entering them on the UI.

POST REQUEST to be posted to below mentioned PayU URLs:

For PayU Test Server:
POST URL: https://test.payu.in/_payment

For PayU Production (LIVE) Server:
POST URL: https://secure.payu.in/_payment
*/

require('dotenv').config()

var express = require('express');
var session = require('express-session');
var app = express();
var bodyParser = require('body-parser');
var path = require('path');
var crypto = require('crypto');
var reqpost = require('request'); //required for verify payment

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({secret: 'mcg001k',saveUninitialized: true,resave: true}));
app.use(express.static(__dirname + '/'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', __dirname);

//Unique merchant key provided by PayU along with salt. Salt is used for Hash signature 
//calculation within application and must not be posted or transfered over internet. 
var key = process.env.KEY;
var salt = process.env.SALT;
var port = process.env.PORT;

//Generate random txnid
app.get('/', function(req,res) {	
	var ord = JSON.stringify(Math.random()*1000);
	var i = ord.indexOf('.');
	ord = 'ORD'+ ord.substr(0,i);	
	res.render(__dirname + '/checkout.html', {orderid:ord, key:key});
	
});

	
/* Request Hash
	----------------
	For hash calculation, you need to generate a string using certain parameters 
	and apply the sha512 algorithm on this string. Please note that you have to 
	use pipe (|) character as delimeter. 
	The parameter order is mentioned below:
	
	sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
	
	Description of each parameter available on html page as well as in PDF.
	
	Case 1: If all the udf parameters (udf1-udf5) are posted by the merchant. Then,
	hash=sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
	
	Case 2: If only some of the udf parameters are posted and others are not. For example, if udf2 and udf4 are posted and udf1, udf3, udf5 are not. Then,
	hash=sha512(key|txnid|amount|productinfo|firstname|email||udf2||udf4|||||||SALT)

	Case 3: If NONE of the udf parameters (udf1-udf5) are posted. Then,
	hash=sha512(key|txnid|amount|productinfo|firstname|email|||||||||||SALT)
	
	In present kit and available PayU plugins UDF5 is used. So the order is -	
	hash=sha512(key|txnid|amount|productinfo|firstname|email|||||udf5||||||SALT)
	
*/
app.post('/', function(req, res){	 
	var strdat = '';
	
	req.on('data', function (chunk) {
        strdat += chunk;
    });
	
	req.on('end', function()
	{
		var data = JSON.parse(strdat);		
		//generate hash with mandatory parameters and udf5
		var cryp = crypto.createHash('sha512');
		var text = key+'|'+data.txnid+'|'+data.amount+'|'+data.productinfo+'|'+data.firstname+'|'+data.email+'|||||'+data.udf5+'||||||'+salt;
		cryp.update(text);
		var hash = cryp.digest('hex');		
		res.setHeader("Content-Type", "text/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify(hash));		
	});	
});

/*Note : After completing transaction process it is recommended to make an enquiry call with PayU to validate the response received and then save the response to DB or display it on UI*/
/* Response received from Payment Gateway at this page.
Process response parameters to generate Hash signature and compare with Hash sent by payment gateway 
to verify response content. Response may contain additional charges parameter so depending on that 
two order of strings are used in this kit.

Hash string without Additional Charges -
hash = sha512(SALT|status||||||udf5|||||email|firstname|productinfo|amount|txnid|key)

With additional charges - 
hash = sha512(additionalCharges|SALT|status||||||udf5|||||email|firstname|productinfo|amount|txnid|key)

*/
app.post('/response.html', function(req, res){
	var verified = 'No';
	var txnid = req.body.txnid;
	var amount = req.body.amount;
	var productinfo = req.body.productinfo;
	var firstname = req.body.firstname;
	var email = req.body.email;
	var udf5 = req.body.udf5;
	var mihpayid = req.body.mihpayid;
	var status = req.body.status;
	var resphash = req.body.hash;
	var additionalcharges = "";
	//Calculate response hash to verify	
	var keyString 		=  	key+'|'+txnid+'|'+amount+'|'+productinfo+'|'+firstname+'|'+email+'|||||'+udf5+'|||||';
	var keyArray 		= 	keyString.split('|');
	var reverseKeyArray	= 	keyArray.reverse();
	var reverseKeyString=	salt+'|'+status+'|'+reverseKeyArray.join('|');
	//check for presence of additionalcharges parameter in response.
	if (typeof req.body.additionalCharges !== 'undefined') {
		additionalcharges = req.body.additionalCharges;
		//hash with additionalcharges
		reverseKeyString=	additionalcharges+'|'+reverseKeyString;
	}
	//Generate Hash
	var cryp = crypto.createHash('sha512');	
	cryp.update(reverseKeyString);
	var calchash = cryp.digest('hex');
	
	var msg = 'Payment failed for Hash not verified...<br />Check Console Log for full response...';
	//Comapre status and hash. Hash verification is mandatory.
	if(calchash == resphash)
		msg = 'Transaction Successful and Hash Verified...<br />Check Console Log for full response...';
	
	console.log(req.body);
	
	//Verify Payment routine to double check payment
	var command = "verify_payment";
	
	var hash_str = key  + '|' + command + '|' + txnid + '|' + salt ;
	var vcryp = crypto.createHash('sha512');	
	vcryp.update(hash_str);
	var vhash = vcryp.digest('hex');
	
	var vdata='';
	var details='';
	
	var options = {
		method: 'POST',
		uri: 'https://test.payu.in/merchant/postservice.php?form=2',
		form: {
			key: key,
			hash: vhash,
			var1: txnid,
			command: command
		},
		headers: {
			/* 'content-type': 'application/x-www-form-urlencoded' */ // Is set automatically
		}
	};
	
	reqpost(options)
		.on('response', function (resp) {
			console.log('STATUS:'+resp.statusCode);
			resp.setEncoding('utf8');
			resp.on('data', function (chunk) {
				vdata = JSON.parse(chunk);	
				if(vdata.status == '1')
				{
					details = vdata.transaction_details[txnid];
					console.log(details['status'] + '   ' + details['mihpayid']);
					if(details['status'] == 'success' && details['mihpayid'] == mihpayid)
						verified ="Yes";
					else
						verified = "No";
					res.render(__dirname + '/response.html', {txnid: txnid,amount: amount, productinfo: productinfo, 
	additionalcharges:additionalcharges,firstname: firstname, email: email, mihpayid : mihpayid, status: status,resphash: resphash,msg:msg,verified:verified});
				}
			});
		})
		.on('error', function (err) {
			console.log(err);
		});
});
/*
		Here is json response example -
		
		{"status":1,
		"msg":"1 out of 1 Transactions Fetched Successfully",
		"transaction_details":</strong>
		{	
			"Txn72738624":
			{
				"mihpayid":"403993715519726325",
				"request_id":"",
				"bank_ref_num":"670272",
				"amt":"6.17",
				"transaction_amount":"6.00",
				"txnid":"Txn72738624",
				"additional_charges":"0.17",
				"productinfo":"P01 P02",
				"firstname":"Viatechs",
				"bankcode":"CC",
				"udf1":null,
				"udf3":null,
				"udf4":null,
				"udf5":"PayUBiz_PHP7_Kit",
				"field2":"179782",
				"field9":" Verification of Secure Hash Failed: E700 -- Approved -- Transaction Successful -- Unable to be determined--E000",
				"error_code":"E000",
				"addedon":"2019-08-09 14:07:25",
				"payment_source":"payu",
				"card_type":"MAST",
				"error_Message":"NO ERROR",
				"net_amount_debit":6.17,
				"disc":"0.00",
				"mode":"CC",
				"PG_TYPE":"AXISPG",
				"card_no":"512345XXXXXX2346",
				"name_on_card":"Test Owenr",
				"udf2":null,
				"status":"success",
				"unmappedstatus":"captured",
				"Merchant_UTR":null,
				"Settled_At":"0000-00-00 00:00:00"
			}
		}
		}
		
		Decode the Json response and retrieve "transaction_details" 
		Then retrieve {txnid} part. This is dynamic as per txnid sent in var1.
		Then check for mihpayid and status.
		
		*/
app.listen(port, () => {
	console.log(`App listening at http://localhost:${port}`)
});
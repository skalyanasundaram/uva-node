const http = require('http');
const qs = require('querystring');
const crypto = require('crypto');
const fs = require('fs');

(function(obj){

obj.trim = function(s){
    return s.replace(/^\s+|\s+$/g, '');
};

obj.getUserHomePath = function () {
    var p = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    if (p) return p;
    throw "Cannot determine user home dir";
};

obj.htmlDecodeSimple = function(s){
    return s.replace(/&apos;/g, '\'')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&');
};

/**
 * @param method GET or POST
 * @param host domain name
 * @param path Absolute path e.g. /index.html
 * @param callback response callback function
 */
obj.createReq = function(method, host, path, callback){
    var options = {
        hostname: host,
        path: path,
        method: method,
        
        // typical headers to disguise our identity
        headers: {
            'Referer': 'http://'+host+path,
            'Accept-Charset': 'ISO-8859-1,utf-8',

            // Use chunked so we don't have to send content-length
            'Transfer-Encoding': 'chunked',
            
            // no gzip :(
            //conn.setRequestProperty("Accept-Encoding", "gzip,deflate");
        
            'Accept-Language': 'en-US,en;q=0.8',
            'User-Agent' :  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_2) "+
                            "AppleWebKit/537.17 (KHTML, like Gecko) "+
                            "Chrome/24.0.1312.57 Safari/537.17",
            "Accept" : "text/html, application/xml, text/xml, */*"
        }
    };

    return http.request(options, callback);
};

obj.writePostData = function(httpReq, data){
    var qstr = qs.stringify(data);
    //httpReq.setHeader('Content-Length', Buffer.byteLength(qstr, 'utf8'));
    httpReq.setHeader('Content-Type',
            "application/x-www-form-urlencoded; charset=UTF-8"); 
    httpReq.end(qstr, 'utf8');
};

obj.writeFormData = function(httpReq, data){
    var boundBytes = crypto.pseudoRandomBytes(16);
    var boundStr = (new Buffer(boundBytes)).toString('hex');
    
    httpReq.setHeader('Content-Type', 
        'multipart/form-data; boundary='+boundStr);

    for (var key in data)
    {
        var val = data[key];
        httpReq.write('--'+boundStr, 'ascii');

        // file upload?
        if (typeof val == 'object' && val.filePath)
        {
            httpReq.write("\r\nContent-Disposition: form-data; name=\""+ key +
                "\"; filename=\""+val.filePath+"\"\r\n"+
                "Content-Type: application/octet-stream\r\n"+
                "Content-Transfer-Encoding: binary\r\n\r\n", "utf8");
                
            fs.createReadStream(val.filePath,
                    { flags: 'r',
                      encoding: null,
                      fd: null,
                      mode: 0666,
                      bufferSize: 64 * 1024,
                      autoClose: true
                    }).pipe(httpReq, {end: false});

            httpReq.write("\r\n", 'ascii');
        }
        else
        {
            httpReq.write("\r\nContent-Disposition: form-data; name=\""+ key +"\"\r\n\r\n", 'utf8');
            httpReq.write(val+"\r\n", 'utf8');
        }
    }

    httpReq.end('--'+boundStr+"--\r\n",'ascii');
};

/**
 * Gets a semi-colon-separated list of cookies from the Set-Cookie headers,
 * without the cookies' metadata such as expiry and path.
 * The cookie keys and values are not decoded.
 * @return null if the cookies are not found.
 */
obj.getCookies = function(inMsg){
    
    var cookies = inMsg.headers["set-cookie"];
    if (typeof cookies == 'string')
    {
        cookies = [cookies];
    }
    else if (!cookies)
        return null;

    function get(line)
    {
        var tokens = line.split(';');
        
        // Cookie should be the first token
        if (tokens.length >= 1)
        {
            var pair = tokens[0].split("=");
            if (pair.length != 2) return null;

            var key = obj.trim(pair[0]);
            var value = obj.trim(pair[1]);

            return {key: key, value: value};
        }

        return null;
    }

    var z = '';
    var sep = '';
    for (var i = 0; i < cookies.length; i++)
    {
        var cookie = get(cookies[i]);
        if (!cookie) continue;
        z += sep + cookie.key + '=' + cookie.value;
        sep = '; ';
    }

    return z;
};

})(module.exports);
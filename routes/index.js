var express = require('express');
var axios = require('axios');
require('dotenv').config();
var router = express.Router();
var _ = require('lodash');
var redirectRoute = "https://" + process.env.DEFAULT_BASE_URI + ".auth.marketingcloudapis.com/v2/authorize?response_type=code&client_id="
  + process.env.CLIENT_ID + "&redirect_uri=" + encodeURIComponent(process.env.APP_REDIRECT_URL);

router.get('/', function (req, res) {
  res.status(200).end();
});

router.get('/oauth', function (req, res, next) {
  var referer = req.headers.referer;
  if (referer && (referer.indexOf('/CloudPages/') > -1 || referer.indexOf('content-builder') > -1)) {
    res.redirect(redirectRoute);
  }
  else {
    res.render('goto');
  }
});

router.get('/login', function (req, res, next) {
  var referer = req.headers.referer;
  if (referer && (referer.indexOf('/CloudPages/') > -1 || referer.indexOf('content-builder') > -1)) {
    res.redirect(redirectRoute);
  }
  else {
    res.render('goto');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.log('error: %o', err);
    }
    res.redirect('login');
  });
});

router.get('/oauth/redirect', function (req, res, next) {
  HandleAuthorize(req, res, next);
});

router.get('/compactView', function (req, res, next) {
  if (req.session && req.session.access_token) {
    res.render('compactView');
  }
  else {
    res.redirect('/oauth');
  }
});

router.get('/contentEditor', function (req, res, next) {
  if (req.session && req.session.access_token) {
    res.render('contentEditor');
  }
  else {
    res.redirect('/oauth');
  }
});

router.get('/oauth/icon.png', function (req, res, next) {
  res.sendFile('icon.png', { root: __dirname });
});

router.get('/oauth/dragIcon.png', function (req, res, next) {
  res.sendFile('dragIcon.png', { root: __dirname });
});

router.get('/oauth/logo.png', function (req, res, next) {
  res.sendFile('logo.png', { root: __dirname });
});

router.post('/saveCropping', function (req, res, next) {
  return saveCropping(req, res, next);
});

function Redirect(code, tse) {
  return axios({
    method: 'post',
    url: `https://${tse}.auth.marketingcloudapis.com/v2/token`,
    headers: {
      accept: 'application/json',
    },
    data: {
      grant_type: 'authorization_code',
      code: `${code}`,
      client_id: `${process.env.CLIENT_ID}`,
      client_secret: `${process.env.CLIENT_SECRET}`,
      redirect_uri: `${process.env.APP_REDIRECT_URL}`,
    },
  })
    .then(function (response) {
      return { "access_token": response.data.access_token, "refresh_token": response.data.refresh_token };
    });
}

function HandleAuthorize(req, res, next) {
  var requestToken = req.query.code;
  var tse = req.query.tssd ? req.query.tssd : process.env.DEFAULT_BASE_URI;

  try {
    Redirect(requestToken, tse)
      .then(async function (response) {
        req.session.access_token = response.access_token;
        req.session.refresh_token = response.refresh_token;
        req.session.tse = tse;

        let result = await getFolders(tse, response.access_token);
        req.session.parentFolder = result.parentFolder;
        req.session.bynderFolder = result.bynderFolder;
        res.redirect('/compactview');
      })
      .catch(function (error) {
        res.locals.message = error.response.data.error_description;
        res.locals.error = { status: error.response.status || 500 };
        // render the error page
        res.status(error.status || 500);
        res.render('error');
      });
  } catch (e) {
    console.log('error: %o', e);
    return next(e);
  }
}

function saveCropping(req, res, next) {
  try {
    req.body.category = req.session.bynderFolder;

    return saveAsset(req.session.tse, req.session.access_token, req.body)
      .then(function (response) {
        res.json(response);
      })
      .catch(function (error) {
        res.locals.message = error.response.data.error_description;
        res.locals.error = { status: error.response.status || 500 };
        // render the error page
        res.status(error.status || 500);
        res.render('error');
      });
  } catch (error) {
    next(error);
  }
}

function saveAsset(tse, token, options) {
  try {
    return axios({
      method: 'post',
      url: `https://${tse}.rest.marketingcloudapis.com/asset/v1/content/assets`,
      headers: {
        accept: 'application/json',
        Authorization: 'Bearer ' + token
      },
      data: options
    })
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
        return null;
      });
  } catch (error) {
    console.log(error);
    return null;
  }
}


function createFolder(tse, token, options) {
  try {
    return axios({
      method: 'post',
      url: `https://${tse}.rest.marketingcloudapis.com/asset/v1/content/categories`,
      headers: {
        accept: 'application/json',
        Authorization: 'Bearer ' + token
      },
      data: options
    })
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
        return null;
      });
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function getFolders(tse, token) {
  // Get both folders
  let parentFolder = await getFolderByNameAndPID(tse, token, "content builder", "0");
  let bynderFolder = await getFolderByNameAndPID(tse, token, "bynder");

  // If no bynder folder, create it
  if (!bynderFolder) {
    var options = { name: "Bynder", parentId: parentFolder.id };
    try {
      bynderFolder = await createFolder(tse, token, options);
    } catch(error) {
      console.log(error);
      bynderFolder = null;
    }
  }

  return {
    parentFolder: parentFolder,
    bynderFolder: bynderFolder
  };
}

async function getFolderByNameAndPID(tse, token, name, parentId, folder, page) {
  if (!page) page = 1;

  try {
    let url = `https://${tse}.rest.marketingcloudapis.com/asset/v1/content/categories?$orderBy=name&$page=${page}`;
    if (parentId) url += `&$filter=parentId eq ${parentId}`;

    let response = await axios({
      method: 'get',
      url: url,
      headers: {
        accept: 'application/json',
        Authorization: 'Bearer ' + token
      }
    });
    
    folder = _.find(response.data.items, function(i) { return i.name.toLowerCase().trim() === name; });

    if (folder) return folder;
    else if (!folder && response.data.items.length == 0) return null;

    page++;
    return await getFolderByName(tse, token, name, parentId, folder, page)

  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = router;

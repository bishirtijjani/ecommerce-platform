const { Router } = require('express');
const searchController = require('./search.controller');

const router = Router();

// Public - browsing (including search) needs no auth, matching the rest of
// the customer app's marketplace routes (see vendor.routes.js).
router.get('/search', searchController.search);
router.get('/nearby', searchController.nearby);

module.exports = router;

const searchService = require('./search.service');
const { ApiResponse } = require('../../utils/api-response');

const search = async (req, res, next) => {
  try {
    const result = await searchService.search({
      q: req.query.q,
      type: req.query.type,
      category: req.query.category,
      lat: req.query.lat,
      lng: req.query.lng,
      radius: req.query.radius,
      // Optional product facets (mirror GET /vendors/products). The service
      // coerces/validates these; passing undefined leaves them off.
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      condition: req.query.condition,
      minRating: req.query.minRating,
      sort: req.query.sort,
    });
    res.json(ApiResponse.success('Search results', result));
  } catch (err) {
    next(err);
  }
};

const nearby = async (req, res, next) => {
  try {
    const result = await searchService.nearby({
      type: req.query.type,
      category: req.query.category,
      lat: req.query.lat,
      lng: req.query.lng,
      radius: req.query.radius,
    });
    res.json(ApiResponse.success('Nearby vendors', result));
  } catch (err) {
    next(err);
  }
};

module.exports = { search, nearby };

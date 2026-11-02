const service = require('./request.service');
const { ApiResponse } = require('../../utils/api-response');

const create = async (req, res, next) => {
  try {
    const data = await service.createRequest(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Request posted', data));
  } catch (err) { next(err); }
};

const listMine = async (req, res, next) => {
  try {
    const data = await service.listMyRequests(req.user.id, req.query);
    res.json(ApiResponse.success('Requests retrieved', data));
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const data = await service.getRequestById(req.params.requestId, { userId: req.user.id, role: req.user.role });
    res.json(ApiResponse.success('Request retrieved', data));
  } catch (err) { next(err); }
};

const cancel = async (req, res, next) => {
  try {
    const data = await service.cancelRequest(req.params.requestId, req.user.id);
    res.json(ApiResponse.success('Request cancelled', data));
  } catch (err) { next(err); }
};

const repost = async (req, res, next) => {
  try {
    const data = await service.repostRequest(req.params.requestId, req.user.id);
    res.json(ApiResponse.success('Request reposted', data));
  } catch (err) { next(err); }
};

const accept = async (req, res, next) => {
  try {
    const data = await service.acceptResponse(req.params.requestId, req.body.responseId, req.user.id);
    res.json(ApiResponse.success('Response accepted', data));
  } catch (err) { next(err); }
};

// --- Vendor side ---
const inbox = async (req, res, next) => {
  try {
    const data = await service.listInbox(req.user.id, req.query);
    res.json(ApiResponse.success('Inbox retrieved', data));
  } catch (err) { next(err); }
};

const markSeen = async (req, res, next) => {
  try {
    const data = await service.markInboxSeen(req.user.id);
    res.json(ApiResponse.success('Inbox marked seen', data));
  } catch (err) { next(err); }
};

const respond = async (req, res, next) => {
  try {
    const data = await service.respondToRequest(req.params.requestId, req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Response sent', data));
  } catch (err) { next(err); }
};

const decline = async (req, res, next) => {
  try {
    const data = await service.declineRequest(req.params.requestId, req.user.id);
    res.json(ApiResponse.success('Request declined', data));
  } catch (err) { next(err); }
};

// --- Admin ---
const adminList = async (req, res, next) => {
  try {
    const data = await service.adminList(req.query);
    res.json(ApiResponse.success('Requests retrieved', data));
  } catch (err) { next(err); }
};

const adminGet = async (req, res, next) => {
  try {
    const data = await service.adminGet(req.params.requestId);
    res.json(ApiResponse.success('Request retrieved', data));
  } catch (err) { next(err); }
};

const adminRemove = async (req, res, next) => {
  try {
    const data = await service.adminRemove(req.params.requestId);
    res.json(ApiResponse.success('Request removed', data));
  } catch (err) { next(err); }
};

module.exports = {
  create, listMine, getById, cancel, repost, accept,
  inbox, markSeen, respond, decline,
  adminList, adminGet, adminRemove,
};

const fs = require('fs');
const mime = require('mime-types');
const { v4: uuidv4 } = require('uuid');
const Queue = require('bull');
const dbClient = require('../utils/db');
const AuthClient = require('../utils/auth');
const basicUtils = require('../utils/basic');

const fileQueue = new Queue('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    const authorization = req.header('X-Token');
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    const user = await AuthClient.authenticateUser(authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!user && req.body.type === 'image') {
      fileQueue.add({});
    }

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const parentFile = await dbClient.getFileById(parentId);
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    let localPath = null;
    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      const fileName = uuidv4();
      localPath = `${folderPath}/${fileName}`;
      const fileData = Buffer.from(data, 'base64');
      fs.writeFileSync(localPath, fileData);
    }

    const newFile = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
    };
    if (localPath) {
      newFile.localPath = localPath;
    }

    const insertedFile = await dbClient.createFile(newFile);

    const responseFile = {
      id: insertedFile._id,
      userId: insertedFile.userId,
      name: insertedFile.name,
      type: insertedFile.type,
      isPublic: insertedFile.isPublic,
      parentId: insertedFile.parentId,
    };

    if (newFile.type === 'image') {
      await fileQueue.add({
        fileId: newFile.id.toString(),
        userId: newFile.userId.toString(),
      });
    }

    return res.status(201).json(responseFile);
  }

  static async getShow(req, res) {
    const authorization = req.header('X-Token');
    const fileId = req.params.id;

    const user = await AuthClient.authenticateUser(authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.getFileById(fileId);
    if (!file || file.userId.toString() !== user._id.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }

    const responseFile = {
      id: file._id,
      ...file,
    };
    delete responseFile._id;
    delete responseFile.localPath;

    return res.status(200).json(responseFile);
  }

  static async getIndex(req, res) {
    const authorization = req.header('X-Token');
    let { parentId = 0, page = 0 } = req.query;

    const user = await AuthClient.authenticateUser(authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (parentId === '0') parentId = 0;
    if (Number.isNaN(page)) page = 0;


    const files = await dbClient.getFilesByParentId(user._id, parentId, page);

    if (!files) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const authorization = req.header('X-Token');
    const fileId = req.params.id;

    const user = await AuthClient.authenticateUser(authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.getFileById(fileId);
    if (!file || file.userId.toString() !== user._id.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }

    file.isPublic = true;
    await dbClient.updateFile(fileId, file);

    return res.status(200).json(file);
  }

  static async putUnpublish(req, res) {
    const authorization = req.header('X-Token');
    const fileId = req.params.id;

    const user = await AuthClient.authenticateUser(authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.getFileById(fileId);
    if (!file || file.userId.toString() !== user._id.toString()) {
      return res.status(404).json({ error: 'Not found' });
    }

    file.isPublic = false;
    await dbClient.updateFile(fileId, file);

    return res.status(200).json(file);
  }

  static async getFile(req, res) {
    const authorization = req.header('X-Token');
    const fileId = req.params.id;
    const size = req.query.size || 0;

    const user = await AuthClient.authenticateUser(authorization);
    const file = await dbClient.getFileById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic && (!user || user._id.toString() !== file.userId.toString())) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    if (!file.localPath || !fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.contentType(file.name);

    try {
      let data = null;
      if (size === 0) {
        data = fs.readFileSync(file.localPath);
      } else {
        data = fs.readFileSync(`${file.localPath}_${size}`);
      }
      res.setHeader('Content-Type', mimeType);
      return res.send(data);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

module.exports = FilesController;

import { Storage } from 'megajs';
import fs from 'fs';
import AppError from "../utils/AppError.js";
import { StatusCodes } from 'http-status-codes';

export class MegaService {
  constructor() {
    this.email = process.env.MEGA_EMAIL;
    this.password = process.env.MEGA_PASSWORD;
    
    if (!this.email || !this.password) {
      console.error('❌ Mega.nz credentials missing');
      throw new Error('Mega.nz credentials are required');
    }
  }

  async uploadFile(filePath, fileName) {
    let storage;
    try {
      console.log('🔐 Logging in to Mega.nz...', {
        email: this.email,
        file: fileName
      });

      // Login to Mega.nz
      storage = await new Storage({
        email: this.email,
        password: this.password,
      }).ready;

      console.log('✅ Logged in to Mega.nz successfully');

      // Get file stats
      const fileStats = fs.statSync(filePath);
      const fileSize = fileStats.size;
      
      console.log(`📤 Starting upload: ${fileName} (${this.formatBytes(fileSize)})`);

      // Read file into buffer
      console.log('📖 Reading file into buffer...');
      const fileBuffer = fs.readFileSync(filePath);
      console.log('✅ File read into buffer');

      // Upload file
      console.log('🔄 Uploading to Mega.nz...');
      const uploadStartTime = Date.now();
      
      const file = await storage.upload(fileName, fileBuffer).complete;
      
      const uploadTime = Date.now() - uploadStartTime;
      console.log(`✅ File upload completed in ${uploadTime}ms:`, file.name);

      // Get download link
      const downloadLink = await file.link();
      console.log('🔗 Generated download link');

      const result = {
        fileName: file.name,
        fileSize: fileSize,
        downloadLink: downloadLink,
        fileId: file.nodeId,
        timestamp: new Date().toISOString(),
        uploadTime: uploadTime
      };

      console.log('📊 Upload result:', result);

      // Close storage connection
      await storage.close();
      console.log('🔒 Storage connection closed');
      
      return result;

    } catch (error) {
      console.error('❌ Mega.nz upload failed:', error);
      
      // Try to close storage if it exists
      try {
        if (storage) await storage.close();
      } catch (closeError) {
        console.error('Error closing storage:', closeError);
      }
      
      throw new AppError(`فشل في رفع الملف إلى Mega.nz: ${error.message}`, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  // Format bytes to human readable
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get account info
  async getAccountInfo() {
    let storage;
    try {
      storage = await new Storage({
        email: this.email,
        password: this.password,
      }).ready;

      const info = {
        email: storage.email,
        usedSpace: storage.usedSpace || 0,
        totalSpace: storage.totalSpace || 0,
        usedFormatted: this.formatBytes(storage.usedSpace || 0),
        totalFormatted: this.formatBytes(storage.totalSpace || 0),
        freeSpace: (storage.totalSpace || 0) - (storage.usedSpace || 0),
        freeFormatted: this.formatBytes((storage.totalSpace || 0) - (storage.usedSpace || 0))
      };

      await storage.close();
      return info;
    } catch (error) {
      console.error('Error getting account info:', error);
      if (storage) await storage.close();
      throw error;
    }
  }
}

export const megaService = new MegaService();
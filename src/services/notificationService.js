import Notification from "../../DB/models/Notification.model.js";
import User from "../../DB/models/user.model.js";

class NotificationService {
  // الحصول على جميع المشرفين
  static async getAdmins() {
    try {
      return await User.find({ role: 'admin' });
    } catch (error) {
      console.error('Error getting admins:', error);
      throw error;
    }
  }

  // الحصول على جميع الطلاب
  static async getAllStudents() {
    try {
      return await User.find({ role: 'student' });
    } catch (error) {
      console.error('Error getting all students:', error);
      throw error;
    }
  }

  // الحصول على طلاب صف معين
  static async getStudentsByGrade(grade) {
    try {
      return await User.find({ role: 'student', grade });
    } catch (error) {
      console.error('Error getting students by grade:', error);
      throw error;
    }
  }

  // 📨 FROM STUDENT TO ADMIN 📨

  // إشعار عند تقديم طلب دعم من الطالب
  static async notifySupportRequest(student, subject, message) {
    try {
      console.log('Sending support request from student:', student.username);
      
      const admins = await this.getAdmins();
      console.log('Found admins:', admins.length);
      
      for (const admin of admins) {
        await this.createNotification({
          title: `طلب دعم: ${subject}`,
          message: `الطالب ${student.username}: ${message}`,
          type: 'support_request',
          recipient: admin._id,
          sender: student._id,
          priority: 'high',
          actionUrl: `/admin/support`
        });
      }
      
      console.log('Support request notifications sent successfully');
    } catch (error) {
      console.error('Error in notifySupportRequest:', error);
      throw error;
    }
  }

  // 📨 FROM ADMIN TO STUDENT 📨

  // إشعار من المشرف لطالب معين
  static async notifyStudentFromAdmin(admin, student, title, message, priority = 'medium') {
    try {
      console.log('Sending notification to student:', student.username);
      
      await this.createNotification({
        title,
        message,
        type: 'admin_message',
        recipient: student._id,
        sender: admin._id,
        priority,
        actionUrl: '/student/notifications'
      });
      
      console.log('Notification sent to student successfully');
    } catch (error) {
      console.error('Error in notifyStudentFromAdmin:', error);
      throw error;
    }
  }

  // إشعار من المشرف لجميع الطلاب
  static async notifyAllStudentsFromAdmin(admin, title, message, priority = 'medium') {
    try {
      console.log('Sending notification to all students');
      
      const students = await this.getAllStudents();
      console.log('Found students:', students.length);
      
      for (const student of students) {
        await this.createNotification({
          title,
          message,
          type: 'admin_announcement',
          recipient: student._id,
          sender: admin._id,
          priority,
          actionUrl: '/student/announcements'
        });
      }
      
      console.log('Notifications sent to all students successfully');
    } catch (error) {
      console.error('Error in notifyAllStudentsFromAdmin:', error);
      throw error;
    }
  }

  // إشعار من المشرف لطلاب صف معين
  static async notifyGradeStudentsFromAdmin(admin, grade, title, message, priority = 'medium') {
    try {
      console.log('Sending notification to grade:', grade);
      
      const students = await this.getStudentsByGrade(grade);
      console.log('Found students in grade:', students.length);
      
      for (const student of students) {
        await this.createNotification({
          title,
          message,
          type: 'grade_announcement',
          recipient: student._id,
          sender: admin._id,
          priority,
          actionUrl: '/student/announcements'
        });
      }
      
      console.log('Notifications sent to grade students successfully');
    } catch (error) {
      console.error('Error in notifyGradeStudentsFromAdmin:', error);
      throw error;
    }
  }

  // إنشاء إشعار عام
  static async createNotification(notificationData) {
    try {
      console.log('Creating notification:', notificationData);
      
      const notification = await Notification.create(notificationData);
      console.log('Notification created successfully:', notification._id);
      
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }
}

export default NotificationService;
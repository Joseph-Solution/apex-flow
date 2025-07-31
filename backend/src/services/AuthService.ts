import { UserRepository } from '../repositories/UserRepository';
import { 
  hashPassword, 
  comparePassword, 
  generateEmailVerificationToken,
  generatePasswordResetToken,
  generatePasswordResetExpiration,
  isPasswordResetTokenExpired,
  validatePasswordStrength
} from '../utils/password';
import { validateAndSanitizeUserInput } from '../utils/validation';
import { 
  RegisterUserRequest, 
  LoginUserRequest, 
  ChangePasswordRequest,
  EmailVerificationRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  User,
  PublicUser 
} from '../models/User';

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterUserRequest): Promise<{
    success: boolean;
    user?: PublicUser;
    errors?: string[];
  }> {
    try {
      // Validate and sanitize input
      const validation = validateAndSanitizeUserInput(userData);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      const { email, username, password, firstName, lastName } = validation.sanitizedData;
      const timezone = 'timezone' in userData ? userData.timezone : undefined;

      // Additional password strength validation
      const passwordValidation = validatePasswordStrength(password!);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          errors: passwordValidation.errors
        };
      }

      // Check if email already exists
      const existingEmailUser = await this.userRepository.findByEmail(email!);
      if (existingEmailUser) {
        return {
          success: false,
          errors: ['Email address is already registered']
        };
      }

      // Check if username already exists
      const existingUsernameUser = await this.userRepository.findByUsername(username!);
      if (existingUsernameUser) {
        return {
          success: false,
          errors: ['Username is already taken']
        };
      }

      // Hash password
      const passwordHash = await hashPassword(password!);

      // Generate email verification token
      const emailVerificationToken = generateEmailVerificationToken();

      // Create user
      const newUser = await this.userRepository.create({
        email: email!,
        username: username!,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        timezone: timezone || 'UTC',
        emailVerificationToken,
        emailVerified: false, // Require email verification
      });

      // Get public user data
      const publicUser = await this.userRepository.getPublicUser(newUser.id);

      return {
        success: true,
        user: publicUser!
      };

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        errors: ['An error occurred during registration. Please try again.']
      };
    }
  }

  /**
   * Login user
   */
  async login(loginData: LoginUserRequest): Promise<{
    success: boolean;
    user?: PublicUser;
    errors?: string[];
  }> {
    try {
      // Validate and sanitize input
      const validation = validateAndSanitizeUserInput(loginData);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      const { email, password } = validation.sanitizedData;

      // Find user by email
      const user = await this.userRepository.findByEmail(email!);
      if (!user) {
        return {
          success: false,
          errors: ['Invalid email or password']
        };
      }

      // Check if user account is active
      if (!user.isActive) {
        return {
          success: false,
          errors: ['Account has been deactivated. Please contact support.']
        };
      }

      // Verify password
      const isPasswordValid = await comparePassword(password!, user.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          errors: ['Invalid email or password']
        };
      }

      // Update last login timestamp
      await this.userRepository.updateLastLogin(user.id);

      // Get public user data
      const publicUser = await this.userRepository.getPublicUser(user.id);

      return {
        success: true,
        user: publicUser!
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        errors: ['An error occurred during login. Please try again.']
      };
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, passwordData: ChangePasswordRequest): Promise<{
    success: boolean;
    errors?: string[];
  }> {
    try {
      const { currentPassword, newPassword } = passwordData;

      // Find user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          errors: ['User not found']
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          errors: ['Current password is incorrect']
        };
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          errors: passwordValidation.errors
        };
      }

      // Check if new password is different from current password
      const isSamePassword = await comparePassword(newPassword, user.passwordHash);
      if (isSamePassword) {
        return {
          success: false,
          errors: ['New password must be different from current password']
        };
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      await this.userRepository.updatePassword(userId, newPasswordHash);

      return {
        success: true
      };

    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        errors: ['An error occurred while changing password. Please try again.']
      };
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(verificationData: EmailVerificationRequest): Promise<{
    success: boolean;
    user?: PublicUser;
    errors?: string[];
  }> {
    try {
      const { token } = verificationData;

      // Find user by verification token
      const user = await this.userRepository.findByEmailVerificationToken(token);
      if (!user) {
        return {
          success: false,
          errors: ['Invalid or expired verification token']
        };
      }

      // Verify email
      await this.userRepository.verifyEmail(user.id);

      // Get updated public user data
      const publicUser = await this.userRepository.getPublicUser(user.id);

      return {
        success: true,
        user: publicUser!
      };

    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        errors: ['An error occurred during email verification. Please try again.']
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(resetData: PasswordResetRequest): Promise<{
    success: boolean;
    errors?: string[];
  }> {
    try {
      // Validate and sanitize input
      const validation = validateAndSanitizeUserInput(resetData);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      const { email } = validation.sanitizedData;

      // Find user by email
      const user = await this.userRepository.findByEmail(email!);
      if (!user) {
        // Don't reveal if email exists or not for security
        return {
          success: true
        };
      }

      // Check if user account is active
      if (!user.isActive) {
        return {
          success: true // Don't reveal account status
        };
      }

      // Generate password reset token and expiration
      const resetToken = generatePasswordResetToken();
      const resetExpiration = generatePasswordResetExpiration();

      // Set password reset token
      await this.userRepository.setPasswordResetToken(user.id, resetToken, resetExpiration);

      // TODO: Send password reset email
      // This would typically involve sending an email with the reset token
      console.log(`Password reset token for ${email}: ${resetToken}`);

      return {
        success: true
      };

    } catch (error) {
      console.error('Password reset request error:', error);
      return {
        success: false,
        errors: ['An error occurred while processing password reset request. Please try again.']
      };
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetData: PasswordResetConfirmRequest): Promise<{
    success: boolean;
    errors?: string[];
  }> {
    try {
      const { token, newPassword } = resetData;

      // Find user by reset token
      const user = await this.userRepository.findByPasswordResetToken(token);
      if (!user) {
        return {
          success: false,
          errors: ['Invalid or expired reset token']
        };
      }

      // Check if token has expired
      if (isPasswordResetTokenExpired(user.passwordResetExpires)) {
        return {
          success: false,
          errors: ['Reset token has expired. Please request a new password reset.']
        };
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          errors: passwordValidation.errors
        };
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password and clear reset token
      await this.userRepository.updatePassword(user.id, newPasswordHash);
      await this.userRepository.clearPasswordResetToken(user.id);

      return {
        success: true
      };

    } catch (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        errors: ['An error occurred while resetting password. Please try again.']
      };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<PublicUser | null> {
    try {
      return await this.userRepository.getPublicUser(userId);
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }
}
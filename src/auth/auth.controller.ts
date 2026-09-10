import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { SessionAuthGuard } from './session-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-reset/confirm')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    const user = await this.authService.login(dto);
    await new Promise<void>((resolve, reject) =>
      request.session.regenerate((error) =>
        error ? reject(error) : resolve(),
      ),
    );
    request.session.userId = user.id;
    return user;
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@Req() request: Request) {
    return this.authService.findPublicUserById(request.session.userId!);
  }

  @UseGuards(SessionAuthGuard)
  @Patch('me')
  updateProfile(@Body() dto: UpdateProfileDto, @Req() request: Request) {
    return this.authService.updateProfile(request.session.userId!, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() request: Request) {
    await new Promise<void>((resolve, reject) =>
      request.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    return { loggedOut: true };
  }
}

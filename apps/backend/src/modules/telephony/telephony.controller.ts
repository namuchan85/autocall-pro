import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CallResponseDto, TelephonyDeviceResponseDto } from './dto/call-response.dto';
import { PlaceCallDto } from './dto/place-call.dto';
import { TelephonyService } from './telephony.service';

@ApiTags('telephony')
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Invalid or expired access token' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('telephony')
export class TelephonyController {
  constructor(private readonly telephony: TelephonyService) {}

  @Get('device')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.VIEWER)
  @ApiOkResponse({ type: TelephonyDeviceResponseDto })
  @ApiServiceUnavailableResponse({ description: 'Galaxy is not ready for ADB calling' })
  getDevice(): Promise<TelephonyDeviceResponseDto> {
    return this.telephony.getDevice();
  }

  @Post('call')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiCreatedResponse({ type: CallResponseDto })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiServiceUnavailableResponse({ description: 'Galaxy is not ready for ADB calling' })
  async placeCall(@Body() input: PlaceCallDto): Promise<CallResponseDto> {
    return CallResponseDto.fromRecord(await this.telephony.placeCall(input.customerId));
  }
}

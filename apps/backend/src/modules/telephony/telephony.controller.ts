import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { AutoDialerService } from './auto-call/auto-dialer.service';
import { AutoCallSnapshotDto, StartAutoCallDto, StopAutoCallDto } from './dto/auto-call.dto';
import {
  CallHistoryResponseDto,
  CallResponseDto,
  TelephonyDeviceResponseDto,
} from './dto/call-response.dto';
import { PlaceCallDto } from './dto/place-call.dto';
import { TelephonyService } from './telephony.service';

@ApiTags('telephony')
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({ description: 'Invalid or expired access token' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('telephony')
export class TelephonyController {
  constructor(
    private readonly telephony: TelephonyService,
    private readonly autoDialer: AutoDialerService,
  ) {}

  @Get('device')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.VIEWER)
  @ApiOkResponse({ type: TelephonyDeviceResponseDto })
  getDevice(): Promise<TelephonyDeviceResponseDto> {
    return this.telephony.getDevice();
  }

  @Get('companion')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.VIEWER)
  getCompanion() {
    return this.telephony.getCompanionStatus();
  }

  @Get('calls')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.VIEWER)
  @ApiOkResponse({ type: [CallHistoryResponseDto] })
  async listCalls(): Promise<CallHistoryResponseDto[]> {
    const items = await this.telephony.listRecentCalls();
    return items.map((item) => CallHistoryResponseDto.fromHistory(item));
  }

  @Get('active-call')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.VIEWER)
  async activeCall(): Promise<CallResponseDto | { id: null }> {
    const active = this.telephony.getActiveCall();
    if (!active) {
      return { id: null };
    }
    await this.telephony.syncActiveCall();
    const synced = this.telephony.getActiveCall() ?? active;
    return CallResponseDto.fromRecord(synced);
  }

  @Post('call')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiCreatedResponse({ type: CallResponseDto })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiForbiddenResponse({ description: 'Customer is not eligible to call' })
  @ApiServiceUnavailableResponse({ description: 'Galaxy is not ready for ADB calling' })
  async placeCall(@Body() input: PlaceCallDto): Promise<CallResponseDto> {
    return CallResponseDto.fromRecord(await this.telephony.placeCall(input.customerId));
  }

  @Post('hangup')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  async hangup(): Promise<CallResponseDto | { id: null }> {
    const result = await this.telephony.hangup();
    return result ? CallResponseDto.fromRecord(result) : { id: null };
  }

  @Post('companion/install')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  installCompanion() {
    return this.telephony.installCompanion();
  }

  @Get('auto-call')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.VIEWER)
  @ApiOkResponse({ type: AutoCallSnapshotDto })
  getAutoCall(): AutoCallSnapshotDto {
    return this.autoDialer.snapshot();
  }

  @Post('auto-call/start')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  startAutoCall(@Body() input: StartAutoCallDto): Promise<AutoCallSnapshotDto> {
    return this.autoDialer.start(input);
  }

  @Post('auto-call/pause')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  pauseAutoCall(): AutoCallSnapshotDto {
    return this.autoDialer.pause();
  }

  @Post('auto-call/resume')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  resumeAutoCall(): Promise<AutoCallSnapshotDto> {
    return this.autoDialer.resume();
  }

  @Post('auto-call/stop')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  stopAutoCall(@Body() input: StopAutoCallDto): Promise<AutoCallSnapshotDto> {
    return this.autoDialer.stop(input.hangupCurrent !== false);
  }
}

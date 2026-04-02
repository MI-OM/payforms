import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Form } from './entities/form.entity';
import { FormField } from './entities/form-field.entity';
import { FormTarget } from './entities/form-target.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Group } from '../group/entities/group.entity';
import { FormService } from './services/form.service';
import { FormController } from './controllers/form.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Form, FormField, FormTarget, Group, Contact])],
  controllers: [FormController],
  providers: [FormService],
  exports: [FormService],
})
export class FormModule {}

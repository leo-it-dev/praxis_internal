import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { QsreportComponent } from './qsreport/qsreport.component';
import { DatepickerComponent } from './datepicker/datepicker.component';

export const routes: Routes = [
    {path: 'login', component: LoginComponent},
    {path: 'qs', component: QsreportComponent},
    {path: "datepicker", component: DatepickerComponent}
];
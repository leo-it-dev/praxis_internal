import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { QsreportComponent } from './qsreport/qsreport.component';

export const routes: Routes = [
    {path: 'login', component: LoginComponent},
    {path: 'qs', component: QsreportComponent},
];
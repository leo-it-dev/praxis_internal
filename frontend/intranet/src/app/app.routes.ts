import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { QsreportComponent } from './qsreport/qsreport.component';
import { SystemOverviewComponent } from './system-overview/system-overview.component';

export const routes: Routes = [
    {path: 'login', component: LoginComponent},
    {path: 'qs', component: QsreportComponent},
    {path: 'system', component: SystemOverviewComponent},
];
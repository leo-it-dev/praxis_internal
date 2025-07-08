import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeploymentDeveloperNoticeComponent } from './deployment-developer-notice.component';

describe('DeploymentDeveloperNoticeComponent', () => {
  let component: DeploymentDeveloperNoticeComponent;
  let fixture: ComponentFixture<DeploymentDeveloperNoticeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeploymentDeveloperNoticeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeploymentDeveloperNoticeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SyncOnlineControllerComponent } from './sync-online-controller.component';

describe('SyncOnlineControllerComponent', () => {
  let component: SyncOnlineControllerComponent;
  let fixture: ComponentFixture<SyncOnlineControllerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SyncOnlineControllerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SyncOnlineControllerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

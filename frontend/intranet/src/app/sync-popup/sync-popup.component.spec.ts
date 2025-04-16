import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SyncPopupComponent } from './sync-popup.component';

describe('SyncPopupComponent', () => {
  let component: SyncPopupComponent;
  let fixture: ComponentFixture<SyncPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SyncPopupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SyncPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

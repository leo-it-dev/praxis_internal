import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserAccountPopupComponent } from './user-account-popup.component';

describe('UserAccountPopupComponent', () => {
  let component: UserAccountPopupComponent;
  let fixture: ComponentFixture<UserAccountPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAccountPopupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserAccountPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

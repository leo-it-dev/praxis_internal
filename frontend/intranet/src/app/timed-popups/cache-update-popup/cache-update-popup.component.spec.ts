import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CacheUpdatePopupComponent } from './cache-update-popup.component';

describe('CacheUpdatePopupComponent', () => {
  let component: CacheUpdatePopupComponent;
  let fixture: ComponentFixture<CacheUpdatePopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CacheUpdatePopupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CacheUpdatePopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

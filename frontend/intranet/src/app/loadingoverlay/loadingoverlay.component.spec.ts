import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingoverlayComponent } from './loadingoverlay.component';

describe('LoadingoverlayComponent', () => {
  let component: LoadingoverlayComponent;
  let fixture: ComponentFixture<LoadingoverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingoverlayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoadingoverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
